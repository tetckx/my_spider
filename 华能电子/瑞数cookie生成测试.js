require('./mod')
require('./encrypt_js_code')
require('./decrypt_js_run_code')



function get_cookie() {
    return document.cookie;
}


console.log(get_cookie());