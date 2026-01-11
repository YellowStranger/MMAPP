from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from django.db.models import Q, Count
from .models import Chat
from .forms import GroupChatForm

User = get_user_model()

@login_required
def index(request, chat_id=None):
    chats = request.user.chats.all().annotate(
        unread_count=Count('messages', filter=~Q(messages__read_by=request.user) & ~Q(messages__sender=request.user))
    ).order_by('-updated_at')
    active_chat = None
    messages = []
    first_unread_id = None
    
    if chat_id:
        active_chat = get_object_or_404(Chat, id=chat_id, members=request.user)
        messages = active_chat.messages.all()

        # Unread messages logic
        unread_messages = messages.exclude(read_by=request.user).exclude(sender=request.user)
        first_unread_id = unread_messages.first().id if unread_messages.exists() else None
        
        # Mark as read
        if unread_messages.exists():
            for msg in unread_messages:
                msg.read_by.add(request.user)

    return render(request, 'chats/index.html', {
        'chats': chats,
        'active_chat': active_chat,
        'messages': messages,
        'first_unread_id': first_unread_id
    })

@login_required
def start_chat(request, username):
    other_user = get_object_or_404(User, username=username)
    if other_user == request.user:
         return redirect('index')
         
    chats = Chat.objects.filter(chat_type='private', members=request.user).filter(members=other_user)
    if chats.exists():
        chat = chats.first()
    else:
        chat = Chat.objects.create(chat_type='private')
        chat.members.add(request.user, other_user)
    
    return redirect('chat_detail', chat_id=chat.id)

@login_required
def create_group(request):
    if request.method == 'POST':
        form = GroupChatForm(request.POST, request.FILES, user=request.user)
        if form.is_valid():
            chat = form.save(commit=False)
            chat.chat_type = 'group'
            chat.save()
            chat.admins.add(request.user)
            chat.members.add(request.user)
            chat.members.add(*form.cleaned_data['members'])
            return redirect('chat_detail', chat_id=chat.id)
    else:
        form = GroupChatForm(user=request.user)
    
    return render(request, 'chats/create_group.html', {'form': form})
