// Global variables
let chatSocket = null;
let replyToId = null;
let editMessageId = null;

// Helper to safely get elements
function getEl(id) { return document.getElementById(id); }

// Global functions exposed to window for HTML onclick attributes
window.replyToMessage = function (id, username, text) {
    replyToId = id;
    const replyPreview = getEl('reply-preview');
    const replyToUser = getEl('reply-to-user');
    const replyText = getEl('reply-text');

    if (replyPreview && replyToUser && replyText) {
        replyPreview.classList.remove('hidden');
        replyToUser.textContent = `Replying to ${username}`;
        replyText.textContent = text;
        getEl('message-input').focus();
    }
    // Cancel any active edit
    window.cancelEdit();
};

window.cancelReply = function () {
    replyToId = null;
    const replyPreview = getEl('reply-preview');
    if (replyPreview) {
        replyPreview.classList.add('hidden');
    }
};

window.editMessage = function (id, text) {
    editMessageId = id;
    const input = getEl('message-input');
    const sendButton = getEl('send-button');

    if (input && sendButton) {
        input.value = text;
        input.focus();
        input.classList.add('ring-2', 'ring-yellow-400');
    }
    // Cancel any active reply
    window.cancelReply();
};

window.cancelEdit = function () {
    editMessageId = null;
    const input = getEl('message-input');
    if (input) {
        input.value = '';
        input.classList.remove('ring-2', 'ring-yellow-400');
    }
};

window.deleteMessage = function (id) {
    if (confirm('Are you sure you want to delete this message?')) {
        chatSocket.send(JSON.stringify({
            'command': 'delete_message',
            'message_id': id
        }));
    }
};

window.scrollToMessage = function (id) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-yellow-100');
        setTimeout(() => el.classList.remove('bg-yellow-100'), 2000);
    }
};

document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('room-id')) return;

    const roomId = JSON.parse(document.getElementById('room-id').textContent);
    const currentUser = JSON.parse(document.getElementById('user-username').textContent);

    // UI Elements
    const messageInput = getEl('message-input');
    const sendButton = getEl('send-button');
    const fileInput = getEl('file-input');
    const filePreview = getEl('file-preview');
    const messagesContainer = getEl('messages-container');
    const micButton = getEl('mic-button');
    const stopRecordingButton = getEl('stop-recording-button');
    const cancelRecordingButton = getEl('cancel-recording-button');
    const recordingUI = getEl('recording-ui');
    const messageInputContainer = getEl('message-input')?.parentElement;
    const recordingTimer = getEl('recording-timer');

    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Initialize WebSocket
    chatSocket = new WebSocket(
        'ws://' + window.location.host + '/ws/chat/' + roomId + '/'
    );

    chatSocket.onopen = function (e) {
        console.log('Chat socket connected');
    };

    chatSocket.onclose = function (e) {
        console.error('Chat socket closed unexpectedly');
    };

    chatSocket.onmessage = function (e) {
        const data = JSON.parse(e.data);
        const command = data.command;

        if (command === 'new_message') {
            const isMe = data.user === currentUser;
            const alignClass = isMe ? 'justify-end' : 'justify-start';
            const bgClass = isMe ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border';

            // Parent message HTML
            let parentHtml = '';
            if (data.parent) {
                const parentBorder = isMe ? 'border-white/50 text-blue-50' : 'border-blue-500 text-gray-500';
                parentHtml = `
                <div class="mb-1 pl-2 border-l-2 ${parentBorder} text-xs cursor-pointer opacity-75" onclick="scrollToMessage('${data.parent.id}')">
                    <span class="font-bold block">${data.parent.sender.username}</span>
                    <span class="truncate block">${data.parent.text.substring(0, 50)}</span>
                </div>`;
            }

            // File HTML
            let fileHtml = '';
            if (data.file && data.file.url) {
                const url = data.file.url;
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                const isAudio = /\.(mp3|wav|ogg|webm)$/i.test(url);

                if (isImage) {
                    fileHtml = `<div class="mt-2"><a href="${url}" target="_blank"><img src="${url}" class="max-w-full h-auto rounded-lg" style="max-height: 300px;"></a></div>`;
                } else if (isAudio) {
                    fileHtml = `<div class="mt-2">
                        <audio controls class="max-w-full">
                            <source src="${url}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                    </div>`;
                } else {
                    fileHtml = `<div class="mt-2"><a href="${url}" target="_blank" class="underline">View Standard Attachment</a></div>`;
                }
            }

            let actionsHtml = '';
            if (isMe) {
                const checksHtml = `
                    <div class="flex items-end ml-1 text-[10px] space-x-[-2px] text-blue-100" id="checks-${data.message_id}">
                        <span>✓</span>
                        <span class="hidden">✓</span>
                    </div>
                 `;

                actionsHtml = `
                <div class="hidden group-hover:flex items-center space-x-1 mr-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onclick="editMessage('${data.message_id}', \`${data.message}\`)" class="text-gray-400 hover:text-blue-500" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                     </button>
                     <button onclick="deleteMessage('${data.message_id}')" class="text-gray-400 hover:text-red-500" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                     </button>
                </div>`;

                innerHtml = `
                 ${actionsHtml}
                 <div id="msg-${data.message_id}" class="${bgClass} max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-2 shadow-sm relative text-left">
                    ${parentHtml}
                    <p class="text-sm break-words whitespace-pre-wrap" id="msg-text-${data.message_id}">${data.message}</p>
                    ${fileHtml}
                    <div class="flex items-center justify-end space-x-1 mt-1">
                        <span class="text-[10px] text-blue-100">${data.timestamp}</span>
                        ${checksHtml}
                    </div>
                 </div>`;

            } else {
                actionsHtml = `
                <div class="hidden group-hover:flex items-center ml-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onclick="replyToMessage('${data.message_id}', '${data.user}', \`${data.message}\`)" class="text-gray-400 hover:text-blue-500" title="Reply">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                     </button>
                </div>`;

                innerHtml = `
                <div id="msg-${data.message_id}" class="${bgClass} max-w-xs md:max-w-md lg:max-w-lg rounded-2xl px-4 py-2 shadow-sm relative text-left">
                    <div class="text-xs text-gray-500 mb-1 font-bold">${data.user}</div>
                    ${parentHtml}
                    <p class="text-sm break-words whitespace-pre-wrap" id="msg-text-${data.message_id}">${data.message}</p>
                    ${fileHtml}
                    <div class="flex items-center justify-end space-x-1 mt-1">
                        <span class="text-[10px] text-gray-400">${data.timestamp}</span>
                    </div>
                 </div>
                 ${actionsHtml}`;
            }

            const messageElement = document.createElement('div');
            messageElement.className = `flex ${alignClass} group mb-4 animate-fade-in-up`;
            messageElement.id = `message-${data.message_id}`;
            messageElement.innerHTML = innerHtml;

            messagesContainer.appendChild(messageElement);
            scrollToBottom();

            if (!isMe && !document.hidden) {
                chatSocket.send(JSON.stringify({
                    'command': 'mark_read',
                    'message_id': data.message_id
                }));
            }

        } else if (command === 'message_read') {
            const checksEl = document.getElementById(`checks-${data.message_id}`);
            if (checksEl) {
                const spans = checksEl.querySelectorAll('span');
                if (spans.length > 1) {
                    spans[1].classList.remove('hidden');
                }
            }
        } else if (command === 'message_updated') {
            const textEl = document.getElementById(`msg-text-${data.message_id}`);
            if (textEl) {
                textEl.textContent = data.message;
                const container = textEl.parentElement;
                if (!container.querySelector('.italic')) {
                    const timeContainer = container.querySelector('.flex.items-center.justify-end');
                    if (timeContainer) {
                        const editedSpan = document.createElement('span');
                        editedSpan.className = 'text-[9px] italic opacity-70 mr-1';
                        editedSpan.textContent = '(edited)';
                        timeContainer.prepend(editedSpan);
                    }
                }
            }
        } else if (command === 'message_deleted') {
            const row = document.getElementById(`message-${data.message_id}`);
            if (row) {
                row.remove();
            } else {
                const bubble = document.getElementById(`msg-${data.message_id}`);
                if (bubble) {
                    const parentRow = bubble.closest('.flex.mb-4');
                    if (parentRow) parentRow.remove();
                }
            }
        }
    };

    // --- Recording Logic ---
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingTimerInterval = null;
    let recordingStartTime = null;
    let isRecording = false;

    if (micButton) micButton.addEventListener('click', startRecording);
    if (stopRecordingButton) stopRecordingButton.addEventListener('click', stopRecording);
    if (cancelRecordingButton) cancelRecordingButton.addEventListener('click', cancelRecording);

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                stream.getTracks().forEach(track => track.stop());
            });

            mediaRecorder.start();
            isRecording = true;

            // UI updates
            if (messageInputContainer) messageInputContainer.classList.add('hidden');
            if (micButton) micButton.classList.add('hidden');
            if (recordingUI) recordingUI.classList.remove('hidden');

            // Timer
            recordingStartTime = Date.now();
            updateRecordingTimer();
            recordingTimerInterval = setInterval(updateRecordingTimer, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please allow permissions.");
        }
    }

    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state === "inactive") return;

        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], "voice_message.webm", { type: 'audio/webm' });
            uploadAudioFile(audioFile);
            resetRecordingUI();
        });

        mediaRecorder.stop();
    }

    function cancelRecording() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        resetRecordingUI();
    }

    function resetRecordingUI() {
        isRecording = false;
        clearInterval(recordingTimerInterval);
        if (messageInputContainer) messageInputContainer.classList.remove('hidden');
        if (micButton) micButton.classList.remove('hidden');
        if (recordingUI) recordingUI.classList.add('hidden');
        if (recordingTimer) recordingTimer.textContent = "00:00";
        audioChunks = [];
    }

    function updateRecordingTimer() {
        if (!recordingTimer) return;
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        recordingTimer.textContent = `${minutes}:${seconds}`;
    }

    function uploadAudioFile(file) {
        const formData = new FormData();
        formData.append('text', '');
        formData.append('file', file);
        const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

        fetch(`/api/upload/${roomId}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrftoken },
            body: formData
        })
            .then(r => r.json())
            .then(d => {
                if (d.file_url) {
                    chatSocket.send(JSON.stringify({
                        'command': 'send_message',
                        'message': '',
                        'message_id': d.message_id,
                        'file_url': d.file_url,
                        'parent_id': replyToId
                    }));
                    window.cancelReply();
                }
            });
    }

    // --- Sending Logic ---
    if (sendButton && messageInput) {
        sendButton.onclick = function (e) {
            e.preventDefault();
            const message = messageInput.value;
            const file = fileInput ? fileInput.files[0] : null;

            if (message || file) {
                if (editMessageId) {
                    chatSocket.send(JSON.stringify({
                        'command': 'edit_message',
                        'message_id': editMessageId,
                        'message': message
                    }));
                    window.cancelEdit();
                } else if (file) {
                    const formData = new FormData();
                    formData.append('text', message);
                    formData.append('file', file);
                    const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

                    fetch(`/api/upload/${roomId}/`, {
                        method: 'POST',
                        headers: { 'X-CSRFToken': csrftoken },
                        body: formData
                    })
                        .then(r => r.json())
                        .then(d => {
                            if (d.file_url) {
                                chatSocket.send(JSON.stringify({
                                    'command': 'send_message',
                                    'message': message,
                                    'message_id': d.message_id,
                                    'file_url': d.file_url,
                                    'parent_id': replyToId
                                }));
                                window.cancelReply();
                                messageInput.value = '';
                                if (fileInput) fileInput.value = '';
                                if (filePreview) filePreview.classList.add('hidden');
                            }
                        });
                } else {
                    chatSocket.send(JSON.stringify({
                        'command': 'send_message',
                        'message': message,
                        'parent_id': replyToId
                    }));
                    window.cancelReply();
                    messageInput.value = '';
                }
            }
        };

        messageInput.onkeyup = function (e) {
            if (e.key === 'Enter') {
                sendButton.click();
            }
        };
    }

    if (fileInput) {
        fileInput.onchange = function () {
            if (this.files && this.files[0]) {
                if (filePreview) {
                    filePreview.textContent = this.files[0].name;
                    filePreview.classList.remove('hidden');
                }
            } else {
                if (filePreview) filePreview.classList.add('hidden');
            }
        };
    }

    scrollToBottom();

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            // Placeholder for read-all logic
        }
    });
});
