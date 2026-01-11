from django.db import models
from django.conf import settings

class Chat(models.Model):
    CHAT_TYPES = (
        ('private', 'Private'),
        ('group', 'Group'),
    )
    chat_type = models.CharField(max_length=10, choices=CHAT_TYPES, default='private')
    name = models.CharField(max_length=255, blank=True)
    avatar = models.ImageField(upload_to='group_avatars/', null=True, blank=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='chats')
    admins = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='admin_chats', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.chat_type == 'private':
            names = ", ".join([user.username for user in self.members.all()[:2]])
            return f"Private Chat ({names})"
        return self.name

class Message(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField(blank=True)
    file = models.FileField(upload_to='chat_files/', null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    is_edited = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='read_messages', blank=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"Message {self.id} from {self.sender}"
