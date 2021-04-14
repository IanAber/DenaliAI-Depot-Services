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
        if ($(this).children('input').attr('checked')) {
            $(this).children('input').attr('checked', false);
            $(this).removeClass('checked');
        } else {
            $(this).children('input').attr('checked', true);
            $(this).addClass('checked');
        }
    });

    $("#serialbarcode").keydown( handleSerialTab);
    loadToken();
    getStatus();
});

function handleSerialTab(event) {
    serial = $("#serialbarcode");
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        // Don't let the system automatically move to another control
        event.preventDefault();
        // Serial must have at least 6 digits.
        if (serial.val().length > 6) {
            updateSerial(serial.val(), getStatusId(), getStatusName(), getOpStatusName());
            serial.val("");
        } else {
            serial.focus();
        }
    }
}

function gotoSerial() {
    $("#serialbarcode").focus();
}

function getStatusName() {
    return $("#status option:selected").text();
}

function getOpStatusName() {
    return $("#opStatus option:selected").text();
}

function getStatusId() {
    return $("#status option:selected").val();
}


function getStatus() {
    body = { busObId:CIStatusObj,
                fields:[CIStatus_Status,CIStatus_RecID]
            };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateStatus)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

function getOpStatus(status) {
    body = { busObId:CIOStatusObj,
                fields:[CIOStatus_OpStat,CIOStatus_RecID],
                filters:[{fieldId:CIOStatus_Status,
                    operator:"eq",
                    value:status}]
                };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            $.post("/cherwellapi/api/V1/getsearchresults", JSON.stringify(body), populateOpStatus)
                .fail(function (xhr, status, error) {
                    alert("Failed : " + status + " | Error : " + error + " | " + xhr.responseText)
                });
        }
    } catch (e) {
        alert(e);
    }
}

function populateStatus(data, status, xhr) {
    var records = data.businessObjects;
    records.forEach(function(status, index) {
        var option = document.createElement("option");
        option.text = status.fields[0].value;
        option.value = status.fields[1].value;
        $('#status').append($('<option>', {
                            value: status.fields[1].value,
                            text: status.fields[0].value}))
    });
}

function populateOpStatus(data, status, xhr) {
    var records = data.businessObjects;
    $('#opStatus').children('option:not(:first)').remove();
    records.forEach(function(status, index) {
        var option = document.createElement("option");
        option.text = status.fields[0].value;
        option.value = status.fields[1].value;
        $('#opStatus').append($('<option>', {
                            value: status.fields[1].value,
                            text: status.fields[0].value}))
    });
}

function changeStatus(){
    var status = getStatusName();
    if (status.length >= 3) {
        getOpStatus(status);
        $("#opStatus").css('visibility', 'visible');
    } else {
        $("#opStatus").css('visibility', 'hidden');
    }
    $("#serialNumber").css('visibility', 'hidden');
}

function changeOpStatus(){
    var opStatus = getOpStatusName();
    if (opStatus.length >= 3) {
        $("#serialNumber").css('visibility', 'visible');
    } else {
        $("#serialNumber").css('visibility', 'hidden');
    }

}

function updateSerial(serial, statusId, status, opStatus) {
    body = { busObId:ConfigObj,
        fields:[Cfg_Status, Cfg_Model, Cfg_Manufacturer, Cfg_OpStatus],
        filters:[{fieldId:Cfg_Serial,
                operator:"eq",
                value:serial}]
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/getsearchresults",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                if (xhr.responseJSON.businessObjects.length != 1) {
                    alert('Config Item Not Found');
                } else {
                    configRecID = xhr.responseJSON.businessObjects[0].busObRecId;
                    oldStatus = xhr.responseJSON.businessObjects[0].fields[0].value;
                    model = xhr.responseJSON.businessObjects[0].fields[1].value;
                    manufacturer = xhr.responseJSON.businessObjects[0].fields[2].value;
                    oldOpStatus = xhr.responseJSON.businessObjects[0].fields[3].value;
                    return updateCI(configRecID, statusId, status, opStatus, oldStatus, oldOpStatus, serial, manufacturer, model);
                }
            } else {
                alert( "Cherwell find Serial failed: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
            return true;
        }
    } catch (e) {
        alert(e);
        return false;
    }
}

function updateCI(recId, statusId, status, opStatus, oldStatus, oldOpStatus, serial, manufacturer, model) {
    body = { busObId:ConfigObj,
        busObRecId: recId,
        fields:[
            {   dirty: true,
                fieldId: Cfg_StatusId,
                value: statusId },
            {   dirty: true,
                fieldId: Cfg_Status,
                value: status },
            {   dirty: true,
                fieldId: Cfg_OpStatus,
                value: opStatus
            }
        ],
        persist: true
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                strMessage = "<li>" + manufacturer + " " + model + " with serial Number " + serial + " changed from <em>" + oldStatus + "|" + oldOpStatus + "</em> to <em>" + status + "|" + opStatus + "</em></li>";
                $("#result").prepend(strMessage);
                return true;
            } else {
                alert( "Cherwell update the CI Status: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
        }
    } catch (e) {
        alert(e);
        return false;
    }
}
