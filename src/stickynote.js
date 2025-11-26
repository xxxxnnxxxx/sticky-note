class StickyNote {
    constructor() {
        this.noteElement = null; // 便签元素
        this.noteInfo = new Map(); // 使用Map存储便签数据
        
        this.currentZIndex = 1000;
        this.currentNoteId = 0;
        this.currentContentEditable = null; // 当前正在编辑的内容区域
        
        this.indicator = null; // 指示器
        this.imgModal = null;
        this.colorModalDialog = null; // 选择颜色的模态对话框
        this.roundedScale = 1; // 箭头和便签位置缩放比例，主要是针对x坐标
        this.preDocumentWidth = document.documentElement.clientWidth;
        
        this.init();
    }

    // 生成页面唯一标识
    generatePageId() {
        // 使用页面URL + 页面内容 + 时间戳生成唯一标识
        const pageContent = document.documentElement.outerHTML;
        const timestamp = Date.now();
        const hash = this.hashCode(window.location.href + pageContent + timestamp);
        return `page_${hash}`;
    }

    // 获取光标所在的最内层元素
    getElementAtCursor() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;
        
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // 如果容器是文本节点，返回其父元素；否则直接返回元素
        return container.nodeType === Node.TEXT_NODE 
            ? container.parentElement 
            : container;
    }

    // 简单的哈希函数
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    }

    moveBox(element, x, y) {
        if (element) {
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;

            console.log(this.noteInfo.get("id"));
        } else {
            console.error('找不到box元素！');
        }

        
    }

    async init() {
        //
        this.setupImageModal();
        this.setupColorModal();
    }

    async createNoteFromData(jsonString) {
        this.noteInfo = this.#deserializationData(jsonString);
        const id = this.noteInfo.get("id");
        if (id) {
            if(this.#hasNoteSticky(id)) {
                console.log("已存在");
                return;
            }
        }

        
        this.noteElement = this.#createNoteElement();

        // 值配置
        // size
        const sizeWidth = this.noteInfo.get('size').get('height');
        const sizeHeight = this.noteInfo.get("size").get("height")
        // position
        const posX = this.noteInfo.get("position").get("x");
        const posY = this.noteInfo.get("position").get("y");
        // 
        
        const pageId = this.noteInfo.get("pageId");
        const title = this.noteInfo.get("title");
        const content = this.noteInfo.get("content");
        const isHidden = this.noteInfo.get("isHidden");
        const backgroundColor = this.noteInfo.get("backgroundColor");
        // 设置位置、尺寸和内容
        this.noteElement.style.left = `${posX}px`;
        this.noteElement.style.top = `${posY}px`;
        this.noteElement.style.width = `${sizeWidth}px`;
        this.noteElement.style.height = `${sizeHeight}px`;
        this.noteElement.dataset.noteId = id;

        const titleInput = this.noteElement.querySelector('.title-input');
        const contentEditable = this.noteElement.querySelector('.content-editable');

        titleInput.value = title || '';
        contentEditable.innerHTML = content || '';

        if (isHidden) {
            this.hideNote(id);
        }

        // 应用保存的背景颜色
        if (backgroundColor) {
            this.applyBackgroundColor(this.noteElement, backgroundColor);
        }

        this.setupNoteEvents(this.noteElement, id);
        return this.noteElement;
    }

    // 随机位置创建便签
    async createNote() {
        const noteId = `note_${Date.now()}_${this.currentNoteId++}`;
        this.noteElement = this.#createNoteElement();
        this.noteElement.dataset.noteId = noteId;

        this.noteInfo.set("id", noteId);
        this.noteInfo.set("pageId", this.pageId);
        this.noteInfo.set("title", "");
        this.noteInfo.set("content", "");
        this.noteInfo.set("position", {
            x: parseFloat(this.noteElement.style.left),
            y: parseFloat(this.noteElement.style.top)
        }),
        this.noteInfo.set("size", {
            width: this.noteElement.offsetWidth,
            height: this.noteElement.offsetHeight
        })
        this.noteInfo.set("isHidden", false);
        this.noteInfo.set("backgroundColor", "bg-yellow-200");
        this.noteInfo.set("createdAt", new Date().toISOString());

        this.setupNoteEvents(this.noteElement, noteId);

        return this.noteElement;
    }

    #createNoteElement(x=-1, y = -1) {
        const templateString = `
        <template id="noteTemplate">
        <div class="sticky-note bg-yellow-200 border border-yellow-300 flex flex-col">
            <!-- 工具栏 -->
            <div class="toolbar p-3 border-b border-yellow-300 flex items-center justify-between flex-shrink-0">
                <div class="flex space-x-2">
                    <button class="format-btn p-2 rounded hover:bg-yellow-300 transition-colors" data-command="bold" title="粗体">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8.21 13c2.106 0 3.412-1.087 3.412-2.823 0-1.306-.984-2.283-2.324-2.386v-.055a2.176 2.176 0 0 0 1.852-2.14c0-1.51-1.162-2.46-3.014-2.46H3.843V13H8.21zM5.908 4.674h1.696c.963 0 1.517.451 1.517 1.244 0 .834-.629 1.32-1.73 1.32H5.908V4.673zm0 6.788V8.598h1.73c1.217 0 1.88.492 1.88 1.415 0 .943-.643 1.449-1.832 1.449H5.907z"/>
                        </svg>
                    </button>
                    <button class="format-btn p-2 rounded hover:bg-yellow-300 transition-colors" data-command="italic" title="斜体">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M7.991 11.674 9.53 4.455c.123-.595.246-.71 1.347-.807l.11-.52H7.211l-.11.52c1.06.096 1.128.212 1.005.807L6.57 11.674c-.123.595-.246.71-1.346.806l-.11.52h3.774l.11-.52c-1.06-.095-1.129-.211-1.006-.806z"/>
                        </svg>
                    </button>
                    <button class="format-btn p-2 rounded hover:bg-yellow-300 transition-colors" data-command="underline" title="下划线">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.313 3.136h-1.23V9.54c0 2.105 1.47 3.623 3.917 3.623s3.917-1.518 3.917-3.623V3.136h-1.23v6.323c0 1.49-.978 2.57-2.687 2.57-1.709 0-2.687-1.08-2.687-2.57V3.136zM12.5 15h-9v-1h9v1z"/>
                        </svg>
                    </button>
                    <button class="image-btn p-2 rounded hover:bg-yellow-300 transition-colors" title="插入图片">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                            <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                        </svg>
                    </button>
                    <button class="color-btn p-2 rounded hover:bg-yellow-300 transition-colors" title="背景颜色">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                            <path d="M16 8c0 3.15-1.866 2.585-3.567 2.07C11.42 9.763 10.465 9.473 10 10c-.603.683-.475 1.819-.351 2.92C9.826 14.495 9.996 16 8 16a8 8 0 1 1 8-8zm-8 7c.611 0 .654-.171.655-.176.078-.146.124-.464.07-1.119-.014-.168-.037-.37-.061-.591-.052-.464-.112-1.005-.118-1.462-.01-.707.083-1.61.704-2.314.369-.417.845-.578 1.272-.618.404-.038.812.026 1.16.104.343.077.702.186 1.025.284l.028.008c.346.105.658.199.953.266.653.148.904.083.991.024C14.717 9.38 15 9.161 15 8a7 7 0 1 0-7 7z"/>
                        </svg>
                    </button>
                </div>
                <div class="flex space-x-2">
                    <button class="hide-btn p-2 rounded hover:bg-yellow-400 transition-colors text-gray-600" title="隐藏便签">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 10.93a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                        </svg>
                    </button>
                    <button class="close-btn p-2 rounded hover:bg-red-400 hover:text-white transition-colors text-gray-600" title="删除便签">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- 内容区域使用flex:1占据剩余空间 -->
            <div class="p-3 flex flex-col flex-1 overflow-hidden">
                <input
                    type="text"
                    class="title-input w-full bg-transparent font-bold text-lg mb-2 outline-none placeholder-gray-600 flex-shrink-0"
                    placeholder="Input Title..."
                >
                <div
                    class="content-editable content-editor-marker bg-transparent text-gray-800 flex-1 overflow-y-auto pr-2"
                    contenteditable="true"
                    placeholder="输入内容..."
                ></div>
            </div>

            <!-- 缩放手柄 -->
            <div class="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-yellow-400 opacity-0 hover:opacity-100 transition-opacity duration-200 border-t border-l border-yellow-500 rounded-tl"></div>
        </div>
        </template>
        `;
        const template = document.createElement('template');
        template.innerHTML = templateString.replace(/<\/?template[^>]*>/g, '').trim();
        const noteElement = template.content.cloneNode(true).querySelector('.sticky-note');

        if (x == -1 || y == -1){
            // 设置随机位置
            const randomX = Math.random() * (window.innerWidth - 350);
            const randomY = Math.random() * (window.innerHeight - 250);
            noteElement.style.left = `${Math.max(20, randomX)}px`;
            noteElement.style.top = `${Math.max(20, randomY)}px`;
            noteElement.style.zIndex = this.currentZIndex++;
        } else {
            noteElement.style.left = `${x}px`;
            noteElement.style.top = `${y}px`;
            noteElement.style.zIndex = this.currentZIndex++;
        }

        // 添加到页面
        document.body.appendChild(noteElement);

        // 初始化
        this.registerResizeListener();
        
        return noteElement;
    }

    #convertObjectToMap(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.#convertObjectToMap(item));
        }
        
        const map = new Map();
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                map.set(key, this.#convertObjectToMap(value));
            } else {
                map.set(key, value);
            }
        }
        return map;
    }
    // 序列化数据
    async #serializationData() {
        if (this.noteInfo == null)
            return;
        const jsonString = JSON.stringify(Object.fromEntries(this.noteInfo));

        console.log(jsonString);
        return jsonString;
    }

    // 反序列化数据
    #deserializationData(jsonString) {
        const data = JSON.parse(jsonString);
        return this.#convertObjectToMap(data);
    }
    // 遍历所有的便签
    getAllNoteStickies() {
        const notes = document.querySelectorAll('.sticky-note');
        const noteIds = Array.from(notes).map(note => note.dataset.noteId);
        return noteIds;
    }

    #hasNoteSticky(noteId) {
        return !!document.querySelector(`[data-note-id="${noteId}"]`);
    }

    // 根据位置创建便签
    async createNotebyPosition(x, y) {
        const noteId = `note_${Date.now()}_${this.currentNoteId++}`;
        this.noteElement = this.#createNoteElement(x,y);
        this.noteElement.dataset.noteId = noteId;
        if (x > 0 && y > 0) {
            this.noteElement.style.left = x;
            this.noteElement.style.top = y;            
        }


        // 初始化便签数据
        this.noteInfo.set("id", noteId);
        this.noteInfo.set("pageId", this.pageId);
        this.noteInfo.set("title", "");
        this.noteInfo.set("content", "");
        this.noteInfo.set("position", {
            x: parseFloat(this.noteElement.style.left),
            y: parseFloat(this.noteElement.style.top)
        }),
        this.noteInfo.set("size", {
            width: this.noteElement.offsetWidth,
            height: this.noteElement.offsetHeight
        })
        this.noteInfo.set("backgroundColor", "bg-yellow-200");
        this.noteInfo.set("createdAt", new Date().toISOString());

        this.setupNoteEvents(this.noteElement, noteId);


        return this.noteElement;
    }

    // 更新note位置
    async #updatePosition() {
        let lastLeft = parseFloat(this.noteElement.style.left) * this.roundedScale|| 0;
        let lastTop = parseFloat(this.noteElement.style.top) || 0;
        this.moveBox(this.noteElement, lastLeft, lastTop);

        // indicator(原形标签)
        let indicator_lastLeft = parseFloat(this.indicator.style.left) *this.roundedScale || 0;
        let indicator_lastTop = parseFloat(this.indicator.style.top) ||0;
        this.moveBox(this.indicator, indicator_lastLeft, indicator_lastTop);
        
    }

    onWindowResize(event) {
        const currentWidth = document.documentElement.clientWidth;
        this.roundedScale = currentWidth/this.preDocumentWidth;
        this.preDocumentWidth = document.documentElement.clientWidth;
        this.#updatePosition();
    }

    registerResizeListener() {
        // 1. 绑定 this 上下文
        // 2. 保存引用以便后续移除
        this.windoResize = this.onWindowResize.bind(this);
        // 3. 添加到 window
        window.addEventListener('resize', this.windoResize);
    }

    setupNoteEvents(noteElement, noteId) {
        const toolbar = noteElement.querySelector('.toolbar');
        const contentEditable = noteElement.querySelector('.content-editable');
        const titleInput = noteElement.querySelector('.title-input');
        const closeBtn = noteElement.querySelector('.close-btn');
        const hideBtn = noteElement.querySelector('.hide-btn');
        const formatBtns = noteElement.querySelectorAll('.format-btn');
        const imageBtn = noteElement.querySelector('.image-btn');
        const colorBtn = noteElement.querySelector('.color-btn');
        const resizeHandle = noteElement.querySelector('.resize-handle');

        // 拖动功能
        this.setupDrag(noteElement, toolbar, noteId);

        // 缩放功能
        this.setupResize(noteElement, resizeHandle, noteId);

        // 关闭按钮
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeNote(noteId);
        });

        // 隐藏按钮
        hideBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideNote(noteId);
        });

        // 格式化按钮
        formatBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const command = btn.dataset.command;
                document.execCommand(command, false, null);
                contentEditable.focus();
            });
        });

        // 图片插入
        imageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentContentEditable = contentEditable;
            this.currentNoteIdForImage = noteId; // 使用不同的变量名避免覆盖
            this.showImageModal();
        });

        // 背景颜色
        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentNoteElement = noteElement;
            this.currentNoteId = noteId;
            this.showColorModal();
        });

        // 内容变化监听
        titleInput.addEventListener('input', () => {
            this.updateNoteData('title', titleInput.value);
        });

        // contentEditable.addEventListener('input', () => {
        //     this.updateNoteData(noteId, { content: contentEditable.innerHTML });
        // });
        // 处理换行时清除格式 - 优化版本，只在特定条件下处理
        let wasEnterPressed = false;
        let lastFormattedElements = [];

        // 监听 enter 键按下的状态
        contentEditable.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                wasEnterPressed = true;

                // 当按下Enter时，记住当前光标位置的格式状态
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const currentNode = range.startContainer;
                    let parentElement = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentElement : currentNode;

                    // 收集当前位置的所有格式元素
                    lastFormattedElements = [];
                    while (parentElement && parentElement !== contentEditable) {
                        if (['STRONG', 'B', 'I', 'U', 'EM'].includes(parentElement.tagName)) {
                            lastFormattedElements.push(parentElement);
                        }
                        parentElement = parentElement.parentElement;
                    }
                }

                setTimeout(() => {
                    wasEnterPressed = false;
                }, 200);
            }
        });

        // 使用 MutationObserver 仅监控新添加的格式化节点
        const observer = new MutationObserver((mutations) => {
            if (!wasEnterPressed) return;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        // 仅处理新行中自动创建的格式化标签
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查是否是浏览器自动生成的格式继承
                            if (node.tagName && ['STRONG', 'B', 'I', 'U', 'EM'].includes(node.tagName)) {
                                // 确保是空元素或者只有换行符的情况才处理
                                const content = node.textContent.trim();
                                if (!content || content === '') {
                                    // 用<br>标签或者纯文本节点替换，避免格式继承
                                    const brElement = document.createElement('br');
                                    node.parentNode.replaceChild(brElement, node);
                                } else {
                                    // 如果有实际内容，转换为纯文本
                                    const textNode = document.createTextNode(content);
                                    node.parentNode.replaceChild(textNode, node);
                                }
                            }
                        }
                    });
                }
            });
        });

        // 开始观察 contentEditable 元素的变化，但减少干扰
        observer.observe(contentEditable, {
            childList: true,
            subtree: true,
            characterData: false, // 不监控字符变化
            attributes: false     // 不监控属性变化
        });

        contentEditable.addEventListener('input', () => {
            this.updateNoteData('content', contentEditable.innerHTML);
        });
        // 双击删除
        noteElement.addEventListener('dblclick', (e) => {
            if (e.target === noteElement || e.target.classList.contains('toolbar')) {
                this.removeNote(noteId);
            }
        });

        // 点击置顶（只在非内容区域）
        noteElement.addEventListener('mousedown', (e) => {
            // 只在工具栏或便签背景上点击时置顶
            if (e.target.classList.contains('toolbar') || e.target === noteElement) {
                noteElement.style.zIndex = this.currentZIndex++;
            }
        });
    }

    setupDrag(element, handle, noteId) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let lastLeft = parseFloat(element.style.left) || 0;
        let lastTop = parseFloat(element.style.top) || 0;
        let animationFrameId = null;

        const startDrag = (e) => {
            // 只在工具栏上开始拖动
            if (!handle.contains(e.target)) return;

            isDragging = true;
            element.classList.add('dragging');

            // 记录当前便签位置作为基准
            lastLeft = parseFloat(element.style.left) || 0;
            lastTop = parseFloat(element.style.top) || 0;

            // 记录鼠标位置
            startX = e.clientX;
            startY = e.clientY;

            // 使用更高效的事件监听
            document.addEventListener('mousemove', drag, { passive: true });
            document.addEventListener('mouseup', stopDrag, { once: true });

            e.preventDefault();
            e.stopPropagation();
        };

        const drag = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = requestAnimationFrame(() => {
                // 计算新位置（增量更新）
                let newLeft = lastLeft + deltaX;
                let newTop = lastTop + deltaY;

                // 边界检查
                const scrollX = window.pageXOffset;
                const scrollY = window.pageYOffset;
                const maxX = scrollX + document.documentElement.clientWidth - 50;
                const maxY = scrollY + document.documentElement.clientHeight - 50;
                const minX = scrollX;
                const minY = scrollY;

                newLeft = Math.max(minX, Math.min(newLeft, maxX));
                newTop = Math.max(minY, Math.min(newTop, maxY));

                element.style.left = `${newLeft}px`;
                element.style.top = `${newTop}px`;
            });
        };

        const stopDrag = () => {
            if (!isDragging) return;

            isDragging = false;
            element.classList.remove('dragging');

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // 获取最终位置并更新数据
            const finalLeft = parseFloat(element.style.left) || 0;
            const finalTop = parseFloat(element.style.top) || 0;

            // 更新位置数据
            this.updateNoteData('position', {
                    x: finalLeft,
                    y: finalTop
            });

            document.removeEventListener('mousemove', drag);
        };

        handle.addEventListener('mousedown', startDrag);
    }

    // 缩放功能
    setupResize(element, handle, noteId) {
        let isResizing = false;
        let startX, startY, initialWidth, initialHeight;
        let animationFrameId = null;

        const startResize = (e) => {
            isResizing = true;
            element.classList.add('resizing');
            handle.classList.add('dragging');

            // 记录初始位置和尺寸
            startX = e.clientX;
            startY = e.clientY;
            initialWidth = element.offsetWidth;
            initialHeight = element.offsetHeight;

            // 使用更高效的事件监听
            document.addEventListener('mousemove', resize, { passive: true });
            document.addEventListener('mouseup', stopResize, { once: true });

            // 阻止文本选择和默认行为
            e.preventDefault();
            e.stopPropagation();
        };

        const resize = (e) => {
            if (!isResizing) return;

            // 使用requestAnimationFrame优化性能
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = requestAnimationFrame(() => {
                // 计算尺寸变化
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                // 计算新尺寸
                let newWidth = initialWidth + deltaX;
                let newHeight = initialHeight + deltaY;

                // 边界检查（最小和最大尺寸）
                newWidth = Math.max(300, Math.min(newWidth, 800));
                newHeight = Math.max(250, Math.min(newHeight, 600));

                // 直接设置尺寸
                element.style.width = `${newWidth}px`;
                element.style.height = `${newHeight}px`;
            });
        };

        const stopResize = () => {
            if (!isResizing) return;

            isResizing = false;
            element.classList.remove('resizing');
            handle.classList.remove('dragging');

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // 获取最终尺寸并更新数据
            const finalWidth = element.offsetWidth;
            const finalHeight = element.offsetHeight;

            this.updateNoteData('size', {
                    width: finalWidth,
                    height: finalHeight
            });

            document.removeEventListener('mousemove', resize);
        };

        handle.addEventListener('mousedown', startResize);
    }

    async updateNoteData(key, value) {
        if(this.noteInfo == null)
            return;
        this.noteInfo.set(key, value);

    }

    async hideNote(noteId) {
        const position = {
            x: parseFloat(this.noteElement.style.left),
            y: parseFloat(this.noteElement.style.top)
        };

        // 添加隐藏类
        this.noteElement.classList.add('hidden');
        this.noteInfo.set("isHidden", true);

        // 创建球形指示器
        const indicator = document.createElement('div');
        indicator.className = 'hidden-note-indicator';
        indicator.style.left = `${position.x}px`;
        indicator.style.top = `${position.y}px`;
        indicator.style.zIndex = "1000";
        indicator.dataset.noteId = noteId;
        this.indicator = indicator;  // 保存原型指示器

        // 添加拖动功能
        this.setupIndicatorDrag(indicator, noteId);
        // 添加右键菜单功能
        this.setupIndicatorContextMenu(indicator, noteId);
        document.body.appendChild(indicator);
    }

    showNote() {
        this.noteElement.classList.remove('hidden');
        this.noteInfo.set("isHidden", false);

        if (this.indicator != null) {
            this.indicator.remove();
            this.indicator = null;
        }
    }

    async removeNote() {
        // 移除DOM元素
        this.noteElement.remove();

        // 移除圆形指示器
        if (this.indicator != null) {
            this.indicator.remove();
            this.indicator = null;
        }
    }

    setupImageModal(rootElement) {
        if (this.imgModal != null)
            return;
        const imageModalString = `
        <div id="imageModal" class="image-modal" style="display: none;">
            <div class="image-modal-content">
                <div class="image-tabs">
                    <button class="image-tab active" data-tab="url">URL insert</button>
                    <button class="image-tab" data-tab="upload">Image Upload</button>
                </div>

                <div id="urlTab" class="tab-content active">
                    <label class="block text-sm font-medium text-gray-700 mb-2">ImageUrl</label>
                    <input
                        type="url"
                        id="imageUrl"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        placeholder="https://example.com/image.jpg"
                    >
                    <div class="mt-4 flex justify-end space-x-2">
                        <button
                            id="cancelUrl"
                            class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            id="insertUrl"
                            class="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                        >
                            Insert Image
                        </button>
                    </div>
                </div>

                <div id="uploadTab" class="tab-content">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select an image</label>
                    <input
                        type="file"
                        id="imageFile"
                        accept="image/*"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    >
                    <div class="mt-4 flex justify-end space-x-2">
                        <button
                            id="cancelUpload"
                            class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            id="insertUpload"
                            class="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                        >
                            Upload and Insert
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        const parser = new DOMParser();
        const doc = parser.parseFromString(imageModalString, 'text/html');
        this.imgModal = doc.body.firstChild;
        document.body.appendChild(this.imgModal);
        // this.imgModal = document.createElement();
        // this.imgModal.innerHTML = imageModalString.replace(/<\/?template[^>]*>/g, '').trim();
        if (rootElement == null){
            const bodyElement = document.body;
            bodyElement.appendChild(this.imgModal);
        } else {

        }
        const tabs = this.imgModal.querySelectorAll('.image-tab');
        const tabContents = this.imgModal.querySelectorAll('.tab-content');
        const cancelUrl = this.imgModal.querySelector('#cancelUrl');
        const insertUrl = this.imgModal.querySelector('#insertUrl');
        const cancelUpload = this.imgModal.querySelector('#cancelUpload');
        const insertUpload = this.imgModal.querySelector('#insertUpload');
        const imageUrl = this.imgModal.querySelector('#imageUrl');
        const imageFile = this.imgModal.querySelector('#imageFile');

        // 标签切换
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // 更新激活状态
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`${tabName}Tab`).classList.add('active');
            });
        });

        // 取消按钮
        cancelUrl.addEventListener('click', () => this.hideImageModal());
        cancelUpload.addEventListener('click', () => this.hideImageModal());

        // URL插入
        insertUrl.addEventListener('click', () => {
            const url = imageUrl.value.trim();
            if (url) {
                this.insertImageFromUrl(url);
                this.hideImageModal();
            }
        });

        // 文件上传
        insertUpload.addEventListener('click', () => {
            const file = imageFile.files[0];
            if (file) {
                this.insertImageFromFile(file);
            }
        });

        // 点击模态框外部关闭
        this.imgModal.addEventListener('click', (e) => {
            if (e.target === this.imgModal) {
                this.hideImageModal();
            }
        });
    }

    showImageModal() {
        if (this.imgModal == null)
            return;
        this.imgModal.style.display = 'flex';

        // 重置表单
        this.imgModal.querySelector('#imageUrl').value = '';
        this.imgModal.querySelector('#imageFile').value = '';
    }

    hideImageModal() {
        this.imgModal.style.display = 'none';
    }

    setupColorModal(rootElement) {
        if (this.colorModalDialog != null)
            return;
        const colorModalDialogString = `
        <!-- 颜色选择器模态框 -->
        <div id="colorModal" class="color-modal" style="display: none;">
            <div class="color-modal-content">
                <h3 class="text-lg font-semibold mb-4">选择便签背景颜色</h3>
                <div class="color-grid grid grid-cols-5 gap-3 mb-4">
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-yellow-200" style="background-color: #fef9c3;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-blue-200" style="background-color: #dbeafe;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-green-200" style="background-color: #dcfce7;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-red-200" style="background-color: #fecaca;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-purple-200" style="background-color: #e9d5ff;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-pink-200" style="background-color: #fbcfe8;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-indigo-200" style="background-color: #c7d2fe;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-teal-200" style="background-color: #99f6e4;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-orange-200" style="background-color: #fed7aa;"></div>
                    <div class="color-option w-8 h-8 rounded cursor-pointer border border-gray-300 hover:scale-110 transition-transform" data-color="bg-gray-200" style="background-color: #e5e7eb;"></div>
                </div>
                <div class="flex justify-end space-x-2">
                    <button
                        id="cancelColor"
                        class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
        `;
        const parser = new DOMParser();
        const doc = parser.parseFromString(colorModalDialogString, 'text/html');
        this.colorModalDialog = doc.body.firstChild;
        if (rootElement == null){
            const bodyElement = document.body;
            bodyElement.appendChild(this.colorModalDialog);
        } else {

        }
        const colorOptions = this.colorModalDialog.querySelectorAll('.color-option');
        const cancelColor = this.colorModalDialog.querySelector('#cancelColor');
        
        // 颜色选项点击
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const colorClass = option.dataset.color;
                this.changeNoteBackgroundColor(colorClass);
                this.hideColorModal();
            });
        });

        // 取消按钮
        cancelColor.addEventListener('click', () => this.hideColorModal());

        // 点击模态框外部关闭
        this.colorModalDialog.addEventListener('click', (e) => {
            if (e.target === this.colorModalDialog) {
                this.hideColorModal();
            }
        });
    }

    showColorModal() {
        if (this.colorModalDialog == null)
            return;
        this.colorModalDialog.style.display = 'flex';
    }

    hideColorModal() {
        if (this.colorModalDialog == null)
            return;
        this.colorModalDialog.style.display = 'none';
    }

    changeNoteBackgroundColor(colorClass) {
        if (!this.currentNoteElement || !this.currentNoteId) return;

        // 移除所有背景颜色类
        const bgClasses = ['bg-yellow-200', 'bg-blue-200', 'bg-green-200', 'bg-red-200',
                            'bg-purple-200', 'bg-pink-200', 'bg-indigo-200', 'bg-teal-200',
                            'bg-orange-200', 'bg-gray-200'];
        bgClasses.forEach(cls => {
            this.currentNoteElement.classList.remove(cls);
        });

        // 添加新的背景颜色类
        this.currentNoteElement.classList.add(colorClass);

        // 更新边框颜色以匹配背景
        const borderColor = colorClass.replace('bg-', 'border-');
        const borderClasses = ['border-yellow-300', 'border-blue-300', 'border-green-300',
                                'border-red-300', 'border-purple-300', 'border-pink-300',
                                'border-indigo-300', 'border-teal-300', 'border-orange-300',
                                'border-gray-300'];
        borderClasses.forEach(cls => {
            this.currentNoteElement.classList.remove(cls);
        });
        this.currentNoteElement.classList.add(borderColor);

        // 更新工具栏边框
        const toolbar = this.currentNoteElement.querySelector('.toolbar');
        if (toolbar) {
            borderClasses.forEach(cls => {
                toolbar.classList.remove(cls);
            });
            toolbar.classList.add(borderColor);
        }

        // 保存颜色设置到数据库
        this.updateNoteData('backgroundColor', colorClass);
    }

    applyBackgroundColor(noteElement, colorClass) {
        // 移除所有背景颜色类
        const bgClasses = ['bg-yellow-200', 'bg-blue-200', 'bg-green-200', 'bg-red-200',
                            'bg-purple-200', 'bg-pink-200', 'bg-indigo-200', 'bg-teal-200',
                            'bg-orange-200', 'bg-gray-200'];
        bgClasses.forEach(cls => {
            noteElement.classList.remove(cls);
        });

        // 添加新的背景颜色类
        noteElement.classList.add(colorClass);

        // 更新边框颜色以匹配背景
        const borderColor = colorClass.replace('bg-', 'border-');
        const borderClasses = ['border-yellow-300', 'border-blue-300', 'border-green-300',
                                'border-red-300', 'border-purple-300', 'border-pink-300',
                                'border-indigo-300', 'border-teal-300', 'border-orange-300',
                                'border-gray-300'];
        borderClasses.forEach(cls => {
            noteElement.classList.remove(cls);
        });
        noteElement.classList.add(borderColor);

        // 更新工具栏边框
        const toolbar = noteElement.querySelector('.toolbar');
        if (toolbar) {
            borderClasses.forEach(cls => {
                toolbar.classList.remove(cls);
            });
            toolbar.classList.add(borderColor);
        }
    }

    insertImageFromUrl(url) {
        if (!this.currentContentEditable) return;

        const img = document.createElement('img');
        img.src = url;
        img.alt = '插入的图片';
        img.onload = () => {
            // 图片加载完成后，确保其大小符合要求
            this.normalizeImageSize(img);
            this.insertImageElement(img);
        };
        img.onerror = () => {
            alert('图片加载失败，请检查URL是否正确');
            img.remove();
        };

        this.insertImageElement(img);
    }

    // 规范化图片大小，确保不溢出
    normalizeImageSize(img) {
        // 设置图片样式以确保正确显示
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.borderRadius = '4px';
        img.style.margin = '4px 0';
    }

    insertImageFromFile(file) {
        if (!this.currentContentEditable) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            img.onload = () => {
                // 图片加载完成后，确保其大小符合要求
                this.normalizeImageSize(img);
                this.insertImageElement(img);
                this.hideImageModal();
            };
            img.onerror = () => {
                alert('图片加载失败');
                this.hideImageModal();
            };
        };
        reader.readAsDataURL(file);
    }

    insertImageElement(img) {
        const contentEditable = this.currentContentEditable;

        // 插入图片到光标位置
        const selection = window.getSelection();
        const contentEditor = this.noteElement.querySelector(".content-editor-marker");
        

        const eleOfselection = this.getElementAtCursor();
        if (contentEditor != eleOfselection)
        {
            contentEditable.appendChild(img);
            contentEditable.appendChild(document.createElement('br'));
        } else {
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.insertNode(img);
                // 在图片后添加换行
                range.insertNode(document.createElement('br'));
            } else {
                contentEditable.appendChild(img);
                contentEditable.appendChild(document.createElement('br'));
            }

            contentEditable.focus();

            // 更新数据库
            if (this.currentNoteIdForImage) {
                this.updateNoteData('content', contentEditable.innerHTML);
            }            
        }

    }

    // 球形指示器拖动功能
    setupIndicatorDrag(indicator, noteId) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let animationFrameId = null;

        const startDrag = (e) => {
            // 阻止默认行为，避免右键菜单触发
            if (e.button !== 0) return; // 只响应左键拖动

            isDragging = true;
            indicator.classList.add('dragging');

            // 记录初始位置和鼠标位置
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseFloat(indicator.style.left) || 0;
            initialTop = parseFloat(indicator.style.top) || 0;

            // 使用更高效的事件监听
            document.addEventListener('mousemove', drag, { passive: true });
            document.addEventListener('mouseup', stopDrag, { once: true });

            e.preventDefault();
            e.stopPropagation();
        };

        const drag = (e) => {
            if (!isDragging) return;

            // 使用requestAnimationFrame优化性能
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = requestAnimationFrame(() => {
                // 计算移动距离
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                // 计算新位置
                let newLeft = initialLeft + deltaX;
                let newTop = initialTop + deltaY;

                // 更精确的边界检查
                const indicatorRect = indicator.getBoundingClientRect();
                const maxX = document.documentElement.clientWidth - indicatorRect.width;
                const maxY = document.documentElement.scrollHeight - indicatorRect.height;

                newLeft = Math.max(0, Math.min(newLeft, maxX));
                newTop = Math.max(0, Math.min(newTop, maxY));

                // 直接设置位置，不使用transform（避免任何动画）
                indicator.style.left = `${newLeft}px`;
                indicator.style.top = `${newTop}px`;
            });
        };

        const stopDrag = () => {
            if (!isDragging) return;

            isDragging = false;
            indicator.classList.remove('dragging');

            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // 获取最终位置并更新便签位置
            const finalLeft = parseFloat(indicator.style.left) || initialLeft;
            const finalTop = parseFloat(indicator.style.top) || initialTop;

            // 更新对应的便签位置
            this.updateNoteData('position', {
                    x: finalLeft,
                    y: finalTop
            });

            document.removeEventListener('mousemove', drag);
        };

        indicator.addEventListener('mousedown', startDrag);
    }

    // 球形指示器右键菜单功能
    setupIndicatorContextMenu(indicator, noteId) {
        let contextMenu = null;

        const showContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 移除现有的右键菜单
            if (contextMenu) {
                contextMenu.remove();
            }

            // 创建右键菜单
            contextMenu = document.createElement('div');
            contextMenu.className = 'context-menu';
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;

            // 添加菜单项
            const showItem = document.createElement('div');
            showItem.className = 'context-menu-item';
            showItem.innerHTML = `
                <svg fill="currentColor" viewBox="0 0 16 16">
                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                </svg>
                显示便签
            `;
            showItem.addEventListener('click', () => {
                this.showNote(noteId);
                contextMenu.remove();
                contextMenu = null;
            });

            const deleteItem = document.createElement('div');
            deleteItem.className = 'context-menu-item';
            deleteItem.innerHTML = `
                <svg fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
                </svg>
                删除便签
            `;
            deleteItem.addEventListener('click', () => {
                this.removeNote(noteId);
                contextMenu.remove();
                contextMenu = null;
            });

            contextMenu.appendChild(showItem);
            contextMenu.appendChild(deleteItem);

            document.body.appendChild(contextMenu);

            // 点击其他地方关闭菜单
            const closeMenu = (e) => {
                if (contextMenu && !contextMenu.contains(e.target)) {
                    contextMenu.remove();
                    contextMenu = null;
                    document.removeEventListener('click', closeMenu);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 100);
        };

        indicator.addEventListener('contextmenu', showContextMenu);

        // 左键点击不再显示便签，改为拖动
        indicator.addEventListener('click', (e) => {
            // 如果正在拖动，不执行点击操作
            if (indicator.classList.contains('dragging')) {
                return;
            }
            // 可以在这里添加其他左键点击功能，比如快速显示
            // this.showNote(noteId);
            // indicator.remove();
        });
    }
}