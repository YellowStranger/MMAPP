import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from asgiref.sync import async_to_sync

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close()
            return

        self.group_name = f'user_{self.user.id}'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def unread_count_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'unread_count_update',
            'chat_id': event['chat_id'],
            'count': event['count']
        }))

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close()
            return

        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Update online status
        await self.update_user_status(True)

    async def disconnect(self, close_code):
        # Update online status
        await self.update_user_status(False)
        
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        command = text_data_json.get('command', 'send_message') # Default to send
        
        if command == 'send_message':
            await self.handle_send_message(text_data_json)
        elif command == 'edit_message':
            await self.handle_edit_message(text_data_json)
        elif command == 'delete_message':
            await self.handle_delete_message(text_data_json)
        elif command == 'mark_read':
            await self.handle_mark_read(text_data_json)

    async def handle_send_message(self, data):
        message_text = data.get('message', '')
        file_url = data.get('file_url')
        message_id = data.get('message_id') # For file upload confirmation flow
        parent_id = data.get('parent_id')

        user_avatar = self.user.avatar.url if self.user.avatar else None

        if message_id:
            # Message created via API (file upload)
            message_obj = await self.get_and_update_message(message_id, parent_id)
        elif message_text:
            # New text message
            message_obj = await self.save_message(message_text, parent_id)
        else:
            return

        if message_obj:
            message_id = message_obj.id
            timestamp = message_obj.timestamp.strftime('%H:%M')
            parent_info = {'id': message_obj.parent.id, 'text': message_obj.parent.text, 'sender': message_obj.parent.sender.username} if message_obj.parent else None
            file_url = message_obj.file.url if message_obj.file else None
            
            # Send message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'command': 'new_message',
                    'message': message_obj.text,
                    'message_id': message_id,
                    'user': self.user.username,
                    'avatar_url': user_avatar,
                    'file_url': file_url,
                    'timestamp': timestamp,
                    'parent': parent_info
                }
            )

    async def handle_edit_message(self, data):
        message_id = data.get('message_id')
        new_text = data.get('message')
        
        success = await self.edit_message_db(message_id, new_text)
        if success:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'command': 'message_updated',
                    'message_id': message_id,
                    'message': new_text,
                }
            )

    async def handle_delete_message(self, data):
        message_id = data.get('message_id')
        
        success = await self.delete_message_db(message_id)
        if success:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'command': 'message_deleted',
                    'message_id': message_id,
                }
            )

    async def handle_mark_read(self, data):
        message_id = data.get('message_id')
        if message_id:
             await self.mark_message_read_db(message_id)

    # Receive message from room group
    async def chat_message(self, event):
        command = event.get('command', 'new_message') # Default for backward compat

        # Common fields
        message_id = event.get('message_id')

        if command == 'new_message':
            await self.send(text_data=json.dumps({
                'type': 'chat_message',
                'command': 'new_message',
                'message': event['message'],
                'message_id': message_id,
                'user': event['user'],
                'timestamp': event.get('timestamp', ''),
                'file': {'url': event.get('file_url')} if event.get('file_url') else None,
                'parent': event.get('parent')
            }))
        elif command == 'message_updated':
            await self.send(text_data=json.dumps({
                'type': 'chat_message',
                'command': 'message_updated',
                'message_id': message_id,
                'message': event['message']
            }))
        elif command == 'message_deleted':
            await self.send(text_data=json.dumps({
                'type': 'chat_message',
                'command': 'message_deleted',
                'message_id': message_id
            }))
        elif command == 'message_read':
            await self.send(text_data=json.dumps({
                'type': 'chat_message',
                'command': 'message_read',
                'message_id': message_id
            }))

    @database_sync_to_async
    def save_message(self, text, parent_id=None):
        from .models import Chat, Message
        chat = Chat.objects.get(id=self.room_name)
        parent = None
        if parent_id:
            try:
                parent = Message.objects.get(id=parent_id)
            except Message.DoesNotExist:
                pass
        msg = Message.objects.create(chat=chat, sender=self.user, text=text, parent=parent)
        
        # Broadcast unread count update
        members = chat.members.all()
        for member in members:
            if member != self.user:
                unread_count = chat.messages.exclude(read_by=member).exclude(sender=member).count()
                channel_layer = self.channel_layer
                async_to_sync(channel_layer.group_send)(
                    f'user_{member.id}',
                    {
                        'type': 'unread_count_update',
                        'chat_id': chat.id,
                        'count': unread_count
                    }
                )
        return msg

    @database_sync_to_async
    def get_and_update_message(self, message_id, parent_id=None):
        from .models import Message
        try:
            msg = Message.objects.get(id=message_id, sender=self.user)
            if parent_id and not msg.parent:
                try:
                    parent = Message.objects.get(id=parent_id)
                    msg.parent = parent
                    msg.save()
                except Message.DoesNotExist:
                    pass
            return msg
        except Message.DoesNotExist:
            return None

    @database_sync_to_async
    def edit_message_db(self, message_id, new_text):
        from .models import Message
        try:
            msg = Message.objects.get(id=message_id, sender=self.user)
            msg.text = new_text
            msg.is_edited = True
            msg.save()
            return True
        except Message.DoesNotExist:
            return False

    @database_sync_to_async
    def delete_message_db(self, message_id):
        from .models import Message
        try:
            msg = Message.objects.get(id=message_id, sender=self.user)
            msg.delete()
            return True
        except Message.DoesNotExist:
            return False

    @database_sync_to_async
    def mark_message_read_db(self, message_id):
        from .models import Message, Chat
        try:
            msg = Message.objects.get(id=message_id)
            if self.user not in msg.read_by.all():
                msg.read_by.add(self.user)
                
                # Update unread count for the user
                chat = msg.chat
                unread_count = chat.messages.exclude(read_by=self.user).exclude(sender=self.user).count()
                
                # Send update to user's notification group
                async_to_sync(self.channel_layer.group_send)(
                    f'user_{self.user.id}',
                    {
                        'type': 'unread_count_update',
                        'chat_id': chat.id,
                        'count': unread_count
                    }
                )

                # Broadcast read receipt to chat room
                async_to_sync(self.channel_layer.group_send)(
                    f'chat_{chat.id}',
                    {
                        'type': 'chat_message',
                        'command': 'message_read',
                        'message_id': msg.id
                    }
                )
        except Message.DoesNotExist:
            pass

    @database_sync_to_async
    def update_user_status(self, is_online):
        self.user.is_online = is_online
        self.user.last_seen = timezone.now()
        self.user.save()
