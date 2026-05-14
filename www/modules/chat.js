class Chat_MessageManager {
    Messages = [];
    static BTTV = {
        loaded: false,
        emotes: [],
    }
    static FFZ = {
        loaded: false,
        emotes: [],
    }
    container;
    pendingMessages = [];
    updateTimeout = null;
    targetContainer = null; // If set, renders into this element instead of creating its own

    constructor(options = {}) {
        this.targetContainer = options.targetContainer || null;
        this.onBodyReady();
        let bttv, ffz;

        if (Config.chat.ExtendedEmotesServices.BTTV === true) {
            bttv = this.fetchBTTVEmotes();
        }

        if (Config.chat.ExtendedEmotesServices.FFZ === true) {
            ffz = this.fetchFFZEmotes();
        }
        if (!this.targetContainer) {
            this.loadMessagesFromStorage(); // Only load saved messages in live mode
        }
        setInterval(() => this.cleanup(), 1000);
    }

    loadMessagesFromStorage() {
        try {
            const savedMessages = localStorage.getItem('chatMessages');
            if (savedMessages) {
                const messageData = JSON.parse(savedMessages);
                messageData.forEach(msgData => {
                    // Create new message object with the saved data
                    const msg = new Chat_Message(msgData);
                    
                    this.Messages.push(msg);
                    
                    // Add the message element to the container
                    const container = document.getElementById('chatMessageArea');
                    let elm = msg.GetElement();
                    
                    if (Config.chat.ChatBoxes?.NewMessages === "above") {
                        container.insertBefore(elm, container.firstChild);
                    } else {
                        container.appendChild(elm);
                    }
                });
            }
        } catch (error) {
        }
    }

    // Save messages to localStorage
    saveMessagesToStorage() {
        try {
            // Filter messages that are still visible
            const visibleMessages = this.Messages.filter(msg => !msg.cleaned);

            // Only keep last N messages to prevent storage issues
            const lastNMessages = visibleMessages.slice(-50); // Adjust number as needed

            // Convert messages to simple objects for storage
            const messageData = lastNMessages.map(msg => ({
                ID: msg.id,
                UserFlags: msg.userFlags,
                UserId: msg.userId,
                Message: msg.message,
                Emotes: msg.emotes,
                DisplayName: msg.display,
                DisplayNameColor: msg.color,
                Badges: msg.badges,
                Platform: msg.platform,
                isRemoved: msg.isRemoved
            }));

            localStorage.setItem('chatMessages', JSON.stringify(messageData));
        } catch (error) {
            console.error('Error saving messages to storage:', error);
        }
    }

    fetchBTTVEmotes() {
        return new Promise(async resolve => {
            await Promise.all([
                fetch('https://api.betterttv.net/3/cached/emotes/global').then(resp => resp.json()).then(data => {
                    const emotes = [];
                    data.forEach(emote => {
                        emotes.push({ name: emote.code, imageUrl: `https://cdn.betterttv.net/emote/${emote.id}/3x` });
                    });
                    Chat_MessageManager.BTTV.emotes = [...emotes, ...Chat_MessageManager.BTTV.emotes];
                    Chat_MessageManager.BTTV.loadedGlobal = true;
                })
                ,
                fetch(`https://api.betterttv.net/3/cached/users/twitch/${Config.TwitchID}`).then(resp => resp.json()).then(data => {
                    const emotes = [];
                    data.channelEmotes.forEach(emote => {
                        emotes.push({ name: emote.code, imageUrl: `https://cdn.betterttv.net/emote/${emote.id}/3x` });
                    });
                    Chat_MessageManager.BTTV.emotes = [...emotes, ...Chat_MessageManager.BTTV.emotes];
                    Chat_MessageManager.BTTV.loadedChannel = true;
                })
            ]);
            resolve();
        });
    }

    fetchFFZEmotes() {
        return new Promise(async resolve => {
            fetch('https://api.frankerfacez.com/v1/set/global').then(resp => resp.json()).then(async data => {
                const emotes = [];

                Object.values(data.sets).forEach(set => {
                    set.emoticons.forEach(emote => {
                        emotes.push({ name: emote.name, imageUrl: `https://cdn.frankerfacez.com/emote/${emote.id}/4` });
                    });
                })
                // check if user has FFZ
                const hasChannel = Object.values(data.users).some(user => user === Config.ChannelName);

                if (hasChannel) {
                    await fetch(`https://api.frankerfacez.com/v1/room/${Config.ChannelName}`).then(resp => resp.json()).then(data => {
                        data.sets.forEach(set => {
                            set.emoticons.forEach(emote => {
                                emotes.push({ name: emote.name, imageUrl: `https://cdn.frankerfacez.com/emote/${emote.id}/4` });
                            });
                        });
                    });
                }

                Chat_MessageManager.FFZ.emotes = emotes;
                Chat_MessageManager.FFZ.loaded = true;
            }).catch();

            resolve();
        });
    }

    cleanup() {
        const container = document.getElementById('chatMessageArea');
        const containerRect = container.getBoundingClientRect();

        this.Messages = this.Messages.filter(msg => {
            if (msg.cleaned) return false;

            const element = msg.GetElement();
            if (!element) return false;

            const elementRect = element.getBoundingClientRect();

            // Always remove messages fully scrolled out the top
            const isAbove = elementRect.bottom < containerRect.top;

            // If clipping is disabled, also remove messages bleeding out the bottom
            const isBelow = !Config.chat.ChatBoxes?.allowClipping && 
                            elementRect.top > containerRect.bottom;

            if (isAbove || isBelow) {
                msg.visible = false;
                msg.cleaned = true;
                container.removeChild(element);
                return false;
            }

            return true;
        });

        // Save remaining messages after cleanup
        this.saveMessagesToStorage();
    }

    loadCSSFile() {
        // Check if already loaded
        if (document.querySelector('link[href*="chat.css"]')) return;
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        // Determine path based on context
        if (document.getElementById('editor-canvas')) {
            // Editor mode — load from www via server
            const host = '127.0.0.1';
            const port = 31589;
            link.href = `http://${host}:${port}/modules/chat.css`;
        } else {
            link.href = 'modules/chat.css';
        }
        document.head.appendChild(link);
    }

    onBodyReady() {
        // Load CSS file
        this.loadCSSFile();

        // If a target container is provided, use it directly
        if (this.targetContainer) {
            const messageArea = this.targetContainer;
            messageArea.id = 'chatMessageArea';
            messageArea.style.overflow = 'hidden';
            messageArea.style.display = 'flex';
            messageArea.style.flexDirection = 'column';
            messageArea.style.width = '100%';
            messageArea.style.height = '100%';

            if (Config.chat.ChatBoxes.position === "bottom") {
                messageArea.style.justifyContent = 'flex-end';
            } else {
                messageArea.style.justifyContent = 'flex-start';
            }

            this.container = messageArea;
            return;
        }
        
        if (Config.chat.mode === "separated") {
            // Create main container
            const mainContainer = document.createElement('div');
            mainContainer.id = 'chatMainContainer';
            mainContainer.style.position = 'fixed';
            mainContainer.style.width = Config.chat.MessageArea.width;
            mainContainer.style.height = Config.chat.MessageArea.height;
            mainContainer.style.top = Config.chat.MessageArea.top;
            mainContainer.style.right = Config.chat.MessageArea.right;
            mainContainer.style.bottom = Config.chat.MessageArea.bottom;
            mainContainer.style.left = Config.chat.MessageArea.left;
            mainContainer.style.display = 'flex';
            mainContainer.style.gap = '10px'; // Space between chat areas
            
            // Create Twitch chat area
            const twitchArea = document.createElement('div');
            twitchArea.id = 'chatMessageArea-twitch';
            twitchArea.style.flex = '1';
            twitchArea.style.overflow = 'hidden';
            twitchArea.style.pointerEvents = 'none';
            twitchArea.style.display = 'flex';
            twitchArea.style.flexDirection = 'column';
            
            // Create YouTube chat area
            const youtubeArea = document.createElement('div');
            youtubeArea.id = 'chatMessageArea-youtube';
            youtubeArea.style.flex = '1';
            youtubeArea.style.overflow = 'hidden';
            youtubeArea.style.pointerEvents = 'none';
            youtubeArea.style.display = 'flex';
            youtubeArea.style.flexDirection = 'column';
    
            // Set justification based on config
            if (Config.chat.ChatBoxes.position === "bottom") {
                twitchArea.style.justifyContent = 'flex-end';
                youtubeArea.style.justifyContent = 'flex-end';
            } else {
                twitchArea.style.justifyContent = 'flex-start';
                youtubeArea.style.justifyContent = 'flex-start';
            }
    
            // Add areas to main container
            mainContainer.appendChild(twitchArea);
            mainContainer.appendChild(youtubeArea);
    
            // Set z-index based on BeforeCanvas setting
            if (Config.chat.BeforeCanvas) {
                mainContainer.style.zIndex = "1";
                document.getElementById("canvas").style.zIndex = "1000";
            } else {
                mainContainer.style.zIndex = "1000";
                document.getElementById("canvas").style.zIndex = "1";
            }
    
            // Add to DOM
            document.getElementById("canvas").insertAdjacentElement(
                Config.chat.BeforeCanvas ? "beforebegin" : "afterend",
                mainContainer
            );
    
        } else {
            // Original single chat area code
            const messageArea = document.createElement('div');
            messageArea.id = 'chatMessageArea';
            
            // Your existing single chat area code...
            messageArea.style.position = 'fixed';
            messageArea.style.width = Config.chat.MessageArea.width;
            messageArea.style.height = Config.chat.MessageArea.height;
            messageArea.style.top = Config.chat.MessageArea.top;
            messageArea.style.right = Config.chat.MessageArea.right;
            messageArea.style.bottom = Config.chat.MessageArea.bottom;
            messageArea.style.left = Config.chat.MessageArea.left;
            messageArea.style.overflow = 'hidden';
            messageArea.style.pointerEvents = 'none';
            messageArea.style.display = 'flex';
            messageArea.style.flexDirection = 'column';
    
            if (Config.chat.ChatBoxes.position === "bottom") {
                messageArea.style.justifyContent = 'flex-end';
            } else {
                messageArea.style.justifyContent = 'flex-start';
            }
    
            if (Config.chat.BeforeCanvas) {
                messageArea.style.zIndex = "1";
                document.getElementById("canvas").style.zIndex = "1000";
            } else {
                messageArea.style.zIndex = "1000";
                document.getElementById("canvas").style.zIndex = "1";
            }
    
            document.getElementById("canvas").insertAdjacentElement(
                Config.chat.BeforeCanvas ? "beforebegin" : "afterend",
                messageArea
            );
    
            this.container = messageArea;
        }
    }

    onMessage(data) {
        if (!data?.Type) {
            console.warn('Received message without Type');
            return;
        }
        console.log(data);
        switch (data.Type) {
            case "MessageAdded":
                this.onMessage_Added(data);
                break;
            case "MessageRemoved":
                this.onMessage_Removed(data);
                break;
            case "MessageRemoveUser":
                this.onMessage_RemoveUser(data);
                break;
            case "ClearChat":
                this.onMessage_ClearChat();
                break;
        }
    }

    queueMessage(msg) {
        this.pendingMessages.push(msg);
        if (!this.updateTimeout) {
            this.updateTimeout = setTimeout(() => this.flushMessages(), 100); // 100ms batch window
        }
    }

    flushMessages() {
        if (Config.chat.mode === "separated") {
            const twitchContainer = document.getElementById('chatMessageArea-twitch');
            const youtubeContainer = document.getElementById('chatMessageArea-youtube');
            
            if (!twitchContainer || !youtubeContainer) {
                console.error('Chat message containers not found');
                return;
            }
    
            const twitchFragment = document.createDocumentFragment();
            const youtubeFragment = document.createDocumentFragment();
            
            this.pendingMessages.forEach(msg => {
                let elm = msg.GetElement();
                if (elm) {
                    if (msg.platform.toLowerCase() === 'youtube') {
                        youtubeFragment.appendChild(elm);
                    } else {
                        twitchFragment.appendChild(elm);
                    }
                }
            });
            
            if (Config.chat.ChatBoxes?.NewMessages === "above") {
                twitchContainer.insertBefore(twitchFragment, twitchContainer.firstChild);
                youtubeContainer.insertBefore(youtubeFragment, youtubeContainer.firstChild);
            } else {
                twitchContainer.appendChild(twitchFragment);
                youtubeContainer.appendChild(youtubeFragment);
                
                // Smooth scroll to bottom for both containers
                requestAnimationFrame(() => {
                    twitchContainer.scrollTo({
                        top: twitchContainer.scrollHeight,
                        behavior: 'smooth'
                    });
                    youtubeContainer.scrollTo({
                        top: youtubeContainer.scrollHeight,
                        behavior: 'smooth'
                    });
                });
            }
        } else {
            // Original combined mode code
            const container = document.getElementById('chatMessageArea');
            if (!container) {
                console.error('Chat message container not found');
                return;
            }
    
            const fragment = document.createDocumentFragment();
            
            this.pendingMessages.forEach(msg => {
                let elm = msg.GetElement();
                if (elm) {
                    fragment.appendChild(elm);
                }
            });
            
            if (Config.chat.ChatBoxes?.NewMessages === "above") {
                container.insertBefore(fragment, container.firstChild);
            } else {
                container.appendChild(fragment);
                
                // Smooth scroll to bottom for combined container
                requestAnimationFrame(() => {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: 'smooth'
                    });
                });
            }
        }
        
        this.pendingMessages = [];
        this.updateTimeout = null;
    }
    

    onMessage_Added(data) {
        if (!data || !data.DisplayName) {
            console.warn('Invalid message data received');
            return;
        }

        const find = Config.Bots?.find(val => val.toLowerCase() == data.DisplayName.toLowerCase());
        if (typeof find === "undefined") {
            // Track start time for performance monitoring
            const startTime = performance.now();
            const msg = new Chat_Message(data);
            this.Messages.push(msg);

            // Implement maximum message limit (500 messages)
            const MAX_MESSAGES = 500;
            if (this.Messages.length > MAX_MESSAGES) {
                const oldestMsg = this.Messages.shift();
                oldestMsg?.GetElement()?.remove();
            }

            // Queue the message for batched rendering
            this.queueMessage(msg);

            // Save messages after adding new one
            this.saveMessagesToStorage();
            
            // Log performance metrics for message processing
            const endTime = performance.now();
            if ((endTime - startTime) > 50) { // Log if processing takes more than 50ms
                console.warn('Slow message processing:', endTime - startTime, 'ms');
            }
        }
    }

    onMessage_Removed(data) {
        const messageToRemove = this.Messages.find(msg => msg.id === data.ID);
        if (messageToRemove) {
            const element = messageToRemove.GetElement();
            if (element) {
                if (Config.chat.RemovedMessage.hideMessage) {
                    element.remove();
                } else {
                    // Clear everything from the element
                    element.innerHTML = '';
                    
                    // Create new content with removed message styling
                    const removedText = document.createElement('span');
                    removedText.textContent = Config.chat.RemovedMessage.Text;
                    removedText.style.color = Config.chat.RemovedMessage.color;
        
                    if (Config.chat.RemovedMessage.italics) {
                        removedText.style.fontStyle = 'italic';
                    }
                    if (Config.chat.RemovedMessage.bold) {
                        removedText.style.fontWeight = 'bold';
                    }
        
                    // Add the new content
                    element.appendChild(removedText);
        
                    // Update the message object
                    messageToRemove.message = Config.chat.RemovedMessage.Text;
                    messageToRemove.isRemoved = true;
                }

                // Save updated messages
                this.saveMessagesToStorage();
            }
        }
    }

    onMessage_RemoveUser(data) {
        // Find all messages from this user
        const messagesToRemove = this.Messages.filter(msg => msg.userId === data.UserId);
        
        messagesToRemove.forEach(messageToRemove => {
            // Get the element for each message
            const element = messageToRemove.GetElement();
            if (element) {
                if (Config.chat.RemovedMessage.hideMessage) {
                    element.remove();
                } else {
                    // Clear everything from the element
                    element.innerHTML = '';
                    
                    // Create new content with removed message styling
                    const removedText = document.createElement('span');
                    removedText.textContent = Config.chat.RemovedMessage.Text;
                    removedText.style.color = Config.chat.RemovedMessage.color;
        
                    if (Config.chat.RemovedMessage.italics) {
                        removedText.style.fontStyle = 'italic';
                    }
                    if (Config.chat.RemovedMessage.bold) {
                        removedText.style.fontWeight = 'bold';
                    }
        
                    // Add the new content
                    element.appendChild(removedText);
        
                    // Update the message object
                    messageToRemove.message = Config.chat.RemovedMessage.Text;
                    messageToRemove.isRemoved = true;
                }
            }
    
            // Save updated messages
            this.saveMessagesToStorage();
        });
    }

    onMessage_ClearChat() {
        try {
            const container = document.getElementById('chatMessageArea');
            if (!container) {
                console.error('Chat message container not found');
                return;
            }
            
            // Clear all messages from DOM
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        
            // Clear messages array and mark as cleaned
            this.Messages.forEach(msg => {
                msg.cleaned = true;
                msg.visible = false;
            });
            
            // Reset messages array
            this.Messages = [];
            
            // Save cleared state
            this.saveMessagesToStorage();
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    
        // Clear localStorage
        localStorage.removeItem('chatMessages');
    }
}

class Chat_Message {
    id;
    userFlags;
    userId;
    message;
    emotes;
    badges;
    display;
    color;
    platform;
    cleaned = false;
    isRemoved = false;

    #element;
    visible = true;

    constructor(msgDataObj) {
        this.id = msgDataObj.ID;
        this.userId = msgDataObj.UserId;
        this.userFlags = msgDataObj.UserFlags;
        this.message = msgDataObj.Message;
        this.emotes = msgDataObj.Emotes;
        this.display = msgDataObj.DisplayName;
        this.color = msgDataObj.DisplayNameColor;
        this.badges = msgDataObj.Badges;
        this.platform = msgDataObj.Platform;
        this.cleaned = false;
        this.isRemoved = msgDataObj.isRemoved

        if (Config.chat.AutoHide?.enabled) {
            setTimeout(this.AutoHide.bind(this), Config.chat.AutoHide.time * 1000)
        }
    }

    cleanup() {
        if (Config.chat.mode === "separated") {
            const twitchContainer = document.getElementById('chatMessageArea-twitch');
            const youtubeContainer = document.getElementById('chatMessageArea-youtube');
            
            const twitchRect = twitchContainer.getBoundingClientRect();
            const youtubeRect = youtubeContainer.getBoundingClientRect();
    
            this.Messages = this.Messages.filter(msg => {
                if (msg.cleaned) return false;
    
                const element = msg.GetElement();
                if (!element) return false;
    
                const elementRect = element.getBoundingClientRect();
                const container = msg.platform.toLowerCase() === 'youtube' ? youtubeContainer : twitchContainer;
                const containerRect = msg.platform.toLowerCase() === 'youtube' ? youtubeRect : twitchRect;
                
                const isOutOfView = elementRect.bottom < containerRect.top;
    
                if (isOutOfView) {
                    msg.visible = false;
                    msg.cleaned = true;
                    element.style.display = "none";
                    container.removeChild(element);
                    return false;
                }
    
                return true;
            });
        } else {
            // Original cleanup code
            const container = document.getElementById('chatMessageArea');
            const containerRect = container.getBoundingClientRect();
    
            this.Messages = this.Messages.filter(msg => {
                if (msg.cleaned) return false;
    
                const element = msg.GetElement();
                if (!element) return false;
    
                const elementRect = element.getBoundingClientRect();
                const isOutOfView = elementRect.bottom < containerRect.top;
    
                if (isOutOfView) {
                    msg.visible = false;
                    msg.cleaned = true;
                    element.style.display = "none";
                    container.removeChild(element);
                    return false;
                }
    
                return true;
            });
        }
    
        // Save remaining messages after cleanup
        this.saveMessagesToStorage();
    }

    AutoHide() {
        if (!this.#element || !this.visible) return;

        // Set initial opacity and transition
        this.#element.style.transition = "all 0.5s ease-out";

        if (Config.chat.AutoHide.animation === "fade") {
            // Fade out animation
            this.#element.style.opacity = "0";
        } else if (Config.chat.AutoHide.animation === "slide") {
            // Slide out animation based on direction
            const direction = Config.chat.AutoHide.direction || "right";
            if (direction === "right") {
                this.#element.style.transform = "translateX(100%)";
            } else if (direction === "left") {
                this.#element.style.transform = "translateX(-100%)";
            }
        }

        // Wait for animation to complete then mark as cleaned
        setTimeout(() => {
            this.visible = false;
            this.cleaned = true;
            this.#element.style.display = "none";
        }, 500); // Match this with transition duration
    }

    GetElement() {
        if (!this.#element) {
            this.#element = this.CreateElement();
        }
        return this.#element;
    }

    EscapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    CreateElement() {
        const container = document.createElement("div");
        container.classList.add('chat-message');
        
        // Apply animation class based on config
        const animationType = Config.chat.ChatBoxes?.animationType || 'fade';
        container.classList.add(`animate-${animationType}`);
        
        // Apply custom styles from config if they exist
        // Apply custom styles from config using CSS Style Declaration API
        if (Config.chat.ChatBoxes?.style) {
            const tempDiv = document.createElement('div');
            Object.entries(Config.chat.ChatBoxes.style).forEach(([prop, value]) => {
                tempDiv.style.setProperty(prop, value);
            });
            // This will automatically handle kebab-case CSS properties
            container.style.cssText += tempDiv.style.cssText;
        }
        
        // Add the message ID and user ID as data attributes
        container.setAttribute('data-message-id', this.id);
        container.setAttribute('data-user-id', this.userId);
    
        // If message is removed, only show the removed message text
        if (this.isRemoved) {
            const removedText = document.createElement('span');
            removedText.textContent = Config.chat.RemovedMessage.Text;
            removedText.style.color = Config.chat.RemovedMessage.color;
            
            if (Config.chat.RemovedMessage.italics) {
                removedText.style.fontStyle = 'italic';
            }
            if (Config.chat.RemovedMessage.bold) {
                removedText.style.fontWeight = 'bold';
            }
            container.style.opacity = "1";
            container.appendChild(removedText);
            return container;
        }

        // Badge container
        const badgeContainer = document.createElement("span");
        badgeContainer.style.marginRight = "5px";

        // Add badges if enabled
        if (Config.chat.ChatBoxes?.ShowBadges) {
            // Add other badges if they exist and aren't hidden
            if (this.badges) {
                this.badges.forEach(badge => {
                    if (!Config.chat.ChatBoxes.HideSpecificBadges?.includes(badge.type)) {
                        const badgeElement = document.createElement("img");
                        badgeElement.src = badge.imageUrl;
                        badgeElement.style.width = `${Config.chat.ChatBoxes.BadgeSettings?.width || 18}px`;
                        badgeElement.style.height = `${Config.chat.ChatBoxes.BadgeSettings?.height || 18}px`;
                        badgeElement.style.verticalAlign = "middle";
                        badgeElement.style.marginRight = "3px";
                        badgeContainer.appendChild(badgeElement);
                    }
                });
            }
        }

        // Username
        const username = document.createElement("span");
        username.textContent = this.display;
        username.style.color = this.color;
        username.style.fontWeight = "bold";

        // Colon separator
        const separator = document.createElement("span");
        if (Config.chat.ChatBoxes?.UserColon !== false) {
            separator.textContent = ": ";
        } else {
            separator.textContent = " ";
        }
        separator.style.marginRight = "4px";

        // Message
        const message = document.createElement("div");
        message.style.display = "inline";

        // Apply messageStyle from config if it exists
        if (Config.chat.ChatBoxes?.messageStyle) {
            const tempDiv = document.createElement('div');
            Object.entries(Config.chat.ChatBoxes.messageStyle).forEach(([prop, value]) => {
                tempDiv.style.setProperty(prop, value);
            });
            message.style.cssText += tempDiv.style.cssText;
        }

        let messageText = this.message;

        if (Config.chat.ChatBoxes?.ShowEmotes) {
            // Combine Twitch emotes and BTTV emotes
            let allEmotes = [
                ...(this.emotes || []),
                ...(Chat_MessageManager.BTTV.loaded ? Chat_MessageManager.BTTV.emotes : []),
                ...(Chat_MessageManager.FFZ.loaded ? Chat_MessageManager.FFZ.emotes : [])
            ];

            // Process all emotes
            allEmotes.forEach(emote => {
                const emoteImg = document.createElement("img");
                emoteImg.src = emote.imageUrl;
                emoteImg.alt = emote.name;
                emoteImg.style = "display: inline; vertical-align: middle; height: 1.2em; margin: 0 2px;";

                messageText = messageText.replace(
                    new RegExp(`(?<!alt=["'][^"']*)(${emote.name})`, 'g'),
                    emoteImg.outerHTML
                );
            });
        }

        message.innerHTML = messageText;

        // Assemble the elements
        container.appendChild(badgeContainer);
        container.appendChild(username);
        container.appendChild(separator);
        container.appendChild(message);

        // Make visible after creation
        requestAnimationFrame(() => {
            container.style.opacity = "1";
        });

        return container;
    }

}

// Only auto-instantiate in overlay mode (not in editor)
if (document.getElementById('canvas')) {
    const chat_MessageHandler = new Chat_MessageManager();

    window.Modules = window.Modules || [];
    window.Modules.push({
        name: "chat",
        message: (data) => {
            chat_MessageHandler.onMessage(data);
        }
    });
}