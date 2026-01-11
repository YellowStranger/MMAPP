from django import template
import os

register = template.Library()

@register.filter
def is_image(file):
    if not file:
        return False
    name = getattr(file, 'name', '')
    ext = os.path.splitext(name)[1].lower()
    return ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']

@register.filter
def is_audio(file):
    if not file:
        return False
    name = getattr(file, 'name', '')
    ext = os.path.splitext(name)[1].lower()
    return ext in ['.mp3', '.wav', '.ogg', '.webm']

@register.filter
def get_chat_name(chat, current_user):
    if chat.chat_type == 'group':
        return chat.name
    # Private chat: return other user's name
    other_members = chat.members.exclude(id=current_user.id)
    if other_members.exists():
        return other_members.first().username
    return "Private Chat"

@register.filter
def get_chat_partner(chat, current_user):
    if chat.chat_type == 'private':
        other_members = chat.members.exclude(id=current_user.id)
        if other_members.exists():
            return other_members.first()
    return None
