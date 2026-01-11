from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from .forms import MessageForm
from .models import Chat

@login_required
@require_POST
def upload_file(request, chat_id):
    chat = Chat.objects.get(id=chat_id)
    if request.user not in chat.members.all():
        return JsonResponse({'error': 'Not authorized'}, status=403)
        
    form = MessageForm(request.POST, request.FILES)
    if form.is_valid():
        message = form.save(commit=False)
        message.chat = chat
        message.sender = request.user
        message.save()
        return JsonResponse({
            'file_url': message.file.url if message.file else None,
            'message_id': message.id
        })
    return JsonResponse({'error': 'Invalid form'}, status=400)
