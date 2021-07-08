/**
 * This variableholds the token for accessing the Cherwell API
 */
var token={
    access:"",
    refresh:"",
    expires:Date.now()
};

function login(e) {
    e.preventDefault();
    var username = $('#username').val();
    var password = $('#password').val();
    var body = {
        grant_type:"password",
        client_id: APIKey,
        username: username,
        password: password,
        auth_mode: "auto"
    }
    $("#waitMsg").css('visibility','visible');
    try {
        $.post("/cherwellapi/token?Auth_mode=auto", body, loginSuccess)
            .fail(function (xhr, status, error) {
                if (username.toLowerCase().indexOf('denaliai\\') == -1) {
                    $('#username').val('DenaliAI\\' + username);
                    $("#doLogin").click();
                } else {
                    if (status == 'error') {
                        alert("Failed to log you in using the credentials supplied.");
                    } else {
                        alert("Failed : " + status + " | Error : " + error);
                    }

                }
            });
    } catch (e) {
        alert(e);
    }
}

function loginSuccess(data, status, xhr) {
    getToken(data, status, xhr);
    var now = new Date();
    if (token.expires > now) {
        $("#loginDiv").css('display','none');
        $("#formDiv").css('visibility', 'visible');
    }
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function getToken(data, status, xhr) {
    if (xhr.status == 200) {
        expires_at = new Date();
        token.access = data.access_token;
        token.refresh = data.refresh_token;
        expires_at.setSeconds(expires_at.getSeconds() + data.expires_in);
        token.expires = expires_at;
        // Save token in a cookie
        setCookie('token', encodeURIComponent(JSON.stringify(token)), 1);
    } else {
        alert("Cherwell communication failure : " + xhr.responseText);
    }
}

function loadToken() {
    strToken = getCookie('token');
    if (strToken == "") {
        alert("Token cookie was not found");
        return;
    }
    token = JSON.parse(decodeURIComponent(strToken));
}

function refreshToken() {
    var now = new Date();
    if (token.expires > now) {
        // No need to refresh, the token is still valid
        return true;
    }
    var body = {
        grant_type: "refresh_token",
        client_id: APIKey,
        refresh_token: token.refresh};
    
    try {
        $.ajaxSetup({headers:{'Content-Type':"application/x-www-form-urlencoded"}});
        xhr = $.ajax({
            type:"POST",
            url: "/cherwellapi/token",
            data:  body,
            dataType: 'json',
            async: false
        });
        if (xhr.status == 200) {
            getToken(JSON.parse(xhr.responseText), xhr.status, xhr);
        } else {
            alert( "Cherwell token refresh failed - Error: " + xhr.status + "\n" + xhr.responseText);
            return false;
        }
        return token.expires > now;
    } catch (e) {
        alert(e);
        return false;
    }
}
