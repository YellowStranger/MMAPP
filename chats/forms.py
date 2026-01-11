from django import forms
from django.contrib.auth import get_user_model
from .models import Chat, Message

User = get_user_model()

class MessageForm(forms.ModelForm):
    class Meta:
        model = Message
        fields = ['text', 'file']

class GroupChatForm(forms.ModelForm):
    members = forms.ModelMultipleChoiceField(
        queryset=User.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=True
    )

    class Meta:
        model = Chat
        fields = ['name', 'avatar', 'members']
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            # Exclude self from selection, self is always admin/member
            self.fields['members'].queryset = User.objects.exclude(id=user.id)
