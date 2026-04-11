/* 代理脚本 */
function get_envs(proxy_array) {
    for (let i = 0; i < proxy_array.length; i++) {
        handler = `{
            get: function(target, property, receiver) {
                   console.log('方法：get','    对象：${proxy_array[i]}','    属性：',property,'    属性类型：',typeof property,'    属性值类型：',typeof target[property]);
                   return target[property];
            },
            set: function(target, property, value, receiver){
                    console.log('方法：set','    对象：${proxy_array[i]}','    属性：',property,'    属性类型：',typeof property,'    属性值类型：',typeof target[property]);
                    return Reflect.set(...arguments);
            }
        }`;
        eval(`
            try {
                ${proxy_array[i]};
                ${proxy_array[i]} = new Proxy(${proxy_array[i]}, ${handler});
            } catch (e) {
                ${proxy_array[i]} = {};
                ${proxy_array[i]} = new Proxy(${proxy_array[i]}, ${handler});
            }
        `);
    }
}

/* 环境补充 */
// window
window = global;
top = window;
window.addEventListener = function () {
}
window.ActiveXObject = undefined;  // 没补充ActiveXObject那么cookie就是假值

// 标签
div = {
    getElementsByTagName: function (tag_name) {
        console.log('div.getElementsByTagName ->', tag_name);
        if (tag_name === 'i') {
            return []
        }
    }
}

head = {
    removeChild: function () {
    }
}

script = {
    getAttribute: function (attr) {
        console.log('script.getAttribute ->', attr);
        if (attr === 'r') {
            return 'm'
        }
    },
    parentElement: head
}

meta = {
    getAttribute: function (attr) {
        console.log('meta.getAttribute ->', attr);
    }
}

// document
document = {
    removeChild: function (node) {
        console.log('document.removeChild ->', node);
    },
    createElement: function (tag_name) {
        console.log('document.createElement ->', tag_name);
        if (tag_name === 'div') {
            return div;
        }
    },
    getElementsByTagName: function (tag_name) {
        console.log('document.getElementsByTagName ->', tag_name);
        if (tag_name === 'script') {
            return [script]
        }
        if (tag_name === 'meta') {
            return [meta]
        }
        if (tag_name === 'base') {
            return []
        }
    },
    getElementById: function (id) {
        console.log('document.getElementById ->', id);
    },
    addEventListener: window.addEventListener
};

// location
location = {
    "ancestorOrigins": {},
    "href": "https://ec.chng.com.cn/channel/home/?SlJfApAfmEBp=1775482526037#/purchase?top=0",
    "origin": "https://ec.chng.com.cn",
    "protocol": "https:",
    "host": "ec.chng.com.cn",
    "hostname": "ec.chng.com.cn",
    "port": "",
    "pathname": "/channel/home/",
    "search": "?SlJfApAfmEBp=1775482526037",
    "hash": "#/purchase?top=0"
}

// navigator
navigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
}

// 定时器置空
setInterval = function () {}
setTimeout = function () {}

/* 代理监听 */
get_envs(['window', 'document', 'div', 'script', 'script.parentElement', 'meta', 'navigator'])

