from django.urls import path
from . import views, api_views

urlpatterns = [
    path('', views.index, name='index'),
    path('chat/<int:chat_id>/', views.index, name='chat_detail'),
    path('start/<str:username>/', views.start_chat, name='start_chat'),
    path('group/new/', views.create_group, name='create_group'),
    path('api/upload/<int:chat_id>/', api_views.upload_file, name='api_upload_file'),
]
