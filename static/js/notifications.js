const notificationSocket = new WebSocket(
    'ws://' + window.location.host + '/ws/notifications/'
);

notificationSocket.onmessage = function (e) {
    const data = JSON.parse(e.data);
    if (data.type === 'unread_count_update') {
        updateSidebarBadge(data.chat_id, data.count);
    }
};

notificationSocket.onclose = function (e) {
    console.error('Notification socket closed unexpectedly');
};

function updateSidebarBadge(chatId, count) {
    const chatLink = document.querySelector(`a[href="/chat/${chatId}/"]`);
    if (chatLink) {
        const container = chatLink.querySelector('.flex.items-center.space-x-3');
        let badge = container.querySelector('.bg-red-600');

        if (count > 0) {
            if (badge) {
                badge.textContent = count;
            } else {
                const badgeHtml = `
                    <span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                        ${count}
                    </span>
                `;
                container.insertAdjacentHTML('beforeend', badgeHtml);
            }
        } else {
            if (badge) {
                badge.remove();
            }
        }
    }
}
