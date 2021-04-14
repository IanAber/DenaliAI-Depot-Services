/**
 * This variableholds the token for accessing the Cherwell API
 */
var token={
    access:"",
    refresh:"",
    expires:Date.now()
};

/**
 * Represents the JSON packet sent to Cherwell on save.
 */
var data={
    tracking:"",
    bin:"",
    nsdata:[],
    serials:[],
};

/**
 * When the document is loaded we need to initialise various controls.
 */
$(document).ready(function () {
    // Login form Click function
    $('.login-form span').on('click', function() {
        alert("Hello");
        if ($(this).children('input').attr('checked')) {
            $(this).children('input').attr('checked', false);
            $(this).removeClass('checked');
        } else {
            $(this).children('input').attr('checked', true);
            $(this).addClass('checked');
        }
    });

    /**
     * Data source for the non-serialised asset counts
     */
    var source =
    {
        localdata: data.nsdata,
        datatype: "array",
        updaterow: function (rowid, rowdata, commit) {
            commit(true);
        },
        datafields:
        [
            { name: 'description', type: 'string' },    // Model from the product table
            { name: 'good_count', type: 'number' },
            { name: 'bad_count', type: 'number' },
        ]
    };

    /**
     * Data source for the serialised asset information
     */
    var serials = 
    {
        localdata: data.serials,
        datatype: "array",
        updaterow: function (rowid, rowdata, commit) {
            commit(true);
        },
        datafields:
        [
                {name: 'serial', type: 'string' },      // Scanned serial number
                {name: 'description', type:'string' },  // Model from the configuration item is found
                {name: 'recid', type:'string' }         // RecID of the configurtion item if found
        ]
    };

    var dataAdapter = new $.jqx.dataAdapter(source);
    var serialAdapter = new $.jqx.dataAdapter(serials);

    $("#serialbarcode").keydown( handleSerialTab);
    $("#binbarcode").keydown( handleBinTab);
    $("#doLogin").click(login)
});

// Require at least 6 characters
function changeTracking() {
    if ($("#trackingbarcode").val() == "") {
        $("#nsgridContainer").css('visibility','hidden');
        $("#serialNumber").css('visibility','hidden');                
        $("#serialGridContainer").css('visibility','hidden');               
        $("#submitDiv").css('visibility','hidden');
    } else if ($("#trackingbarcode").val().length > 6) {
        $("#nsgridContainer").css('visibility','visible');
        $("#serialNumber").css('visibility','visible');
        $("#serialGridContainer").css('visibility','visible');
        $("#submitDiv").css('visibility','visible');
        $("#serialbarcode").focus();
    }
}
function addToBin() {
    serial = $("#serialbarcode");
    bin = $("#binbarcode");
    if ((bin.val().length > 6) && (serial.val().length > 6)) {

        $("#serialNumbers").jqxGrid('addrow', null, {serial: serial.val(), description: "", bin: bin.val()});
        getSerialisedDescription(serial.val());
        serial.val("");
        bin.val("");
        serial.focus();
    }
}

function handleSerialTab(event) {
    serial = $("#serialbarcode");
    bin = $("#binbarcode");
    if (event.key == 'Tab') {
        // Don't let the system automatically move to another control
        event.preventDefault();
        // Tab between serial and bin until both have at least 6 digits.
        if (serial.val().length > 6) {
            findAsset(serial.val());
        }
    }
}

function handleBinTab(event) {
    bin = $("#binbarcode");
    if (event.key == 'Tab') {
        // Don't let the system automatically move to another control
        event.preventDefault();
        recID = $("#RecID").val();
        if ((bin.val().length > 6) && (recID.length==42)) {
            addToBin(bin.val(), recID);
        }
    }
}

function login(e) {
    e.preventDefault();
    var username = $('#username').val();
    var password = $('#password').val();
    var body = {
        grant_type:"password",
        client_id: APIKey,
        username: username,
        password: password,
        auth_mode: "internal"
    }
    $("#waitMsg").css('visibility','visible');
    try {
        $.post("/cherwellapi/token", body, loginSuccess)
            .fail(function (xhr, status, error) {
                alert("Failed : " + status + " | Error : " + error)
            });
    } catch (e) {
        alert(e);
    }
}

function getToken(data, status, xhr) {
    if (xhr.status == 200) {
        expires_at = new Date();
        token.access = data.access_token;
        token.refresh = data.refresh_token;
        expires_at.setSeconds(expires_at.getSeconds() + data.expires_in);
        token.expires = expires_at;
    } else {
        alert("Cherwell communication failure : " + xhr.responseText);
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

function findAsset(serial){
    body = { busObId:ConfigObj,
                fields:[Cfg_Model,Cfg_RecID,Cfg_Serial,Cfg_Manufacturer],
                filters:[{fieldId:Cfg_Serial,
                        operator:"eq",
                        value:serial}]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateDescription)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

function populateDescription(data, status, xhr) {
    var records = data.businessObjects;
    if (records.length == 1) {
        var model = records[0].fields[0].value;
        var recId = records[0].fields[1].value;
        var serial = records[0].fields[2].value;
        var manufacturer = records[0].fields[3].value;
        $('#assetDescription').text(manufacturer + " - " + model);
        $('#RecID').val(recId);
        $('#binbarcode').focus();
    } else {
        $('#assetDescription').text("Item not found!");
        $('#RecID').val("");
        $('#serialbarcode').val("");
        $('#serialbarcode').focus();
    }
}

function clearForm() {
    $("#serialbarcode").val("");
    $("#assetDescription").text("");
    $("#RecID").val("");
    $("#binbarcode").val("");
    $("#serialbarcode").focus();
}

function addToBin() {

    var body = {busObId:ConfigObj,
                busObRecId: $('#RecID').val(),
                fields:[
                    { dirty:true, fieldId: Cfg_Bin, value: $('#binbarcode').val() }
                ],
                persist: true
            };

    if ($("#RecID").val() != "") {
        try {
            if (refreshToken()) {
                $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                    'Content-Type':"application/json"}});
                $.post("/cherwellapi/api/V1/savebusinessobject", JSON.stringify(body), saveComplete)
                    .fail(function (xhr, status, error) {
                        alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                    });
            }
        } catch (e) {
            alert(e);
        }            
    }
}

function saveComplete(data, status, xhr) {
    if (xhr.status == 200) {
        $("#list").prepend("<li>" + $("#assetDescription").text() + " serial #" + $("#serialbarcode").val() + " ===> bin #" + $("#binbarcode").val() + "</li>");
        clearForm();
    } else {
        alert("Failed!\n" + xhr.responseText);
    }
}
