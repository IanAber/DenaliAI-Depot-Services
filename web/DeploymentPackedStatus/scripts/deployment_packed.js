/**
 * This variableholds the token for accessing the Cherwell API
 */
var token={
    access:"",
    refresh:"",
    expires:Date.now()
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

    $("#trackingbarcode").keydown( handleTrackingTab);
    loadToken();
});

function handleTrackingTab(event) {
    tracking = $("#trackingbarcode");
    if ((event.key == 'Tab') || (event.key == 'Enter')) {
        // Don't let the system automatically move to another control
        event.preventDefault();
        // Tracking must have at least 6 digits.
        if (tracking.val().length > 6) {
            updateTracking(tracking.val());
            tracking.val("");
        } else {
            tracking.focus();
        }
    }
}

function gotoTracking() {
    $("#trackingbarcode").focus();
}

function updateTracking(tracking) {
    body = { busObId:SM_Obj,
        fields:[SM_OutboundTrack, SM_ParentRecID],
        filters:[{fieldId:SM_OutboundTrack,
                operator:"eq",
                value:tracking}]
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/getsearchresults",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                if (xhr.responseJSON.businessObjects.length != 1) {
                    alert('A Ship Manager record with the tracking number [' + tracking + '] could not be found.');
                } else {
                    shipManagerRecID = xhr.responseJSON.businessObjects[0].busObRecId;
                    productDeploymentRecID = xhr.responseJSON.businessObjects[0].fields[1].value;
                    return updateSM(shipManagerRecID, tracking, productDeploymentRecID);
                }
            } else {
                alert( "Cherwell find by tracking number failed: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
            return true;
        }
    } catch (e) {
        alert(e);
        return false;
    }
}

function addJournalNote(pdRecID, note) {
    body = { busObId:Journal_Obj,
        fields:[
            {
                dirty: true,
                fieldId: J_ParentRecId,
                value: pdRecID
            }, {
                dirty: true,
                fieldId: J_Note,
                value: note
            }, {
                dirty: true,
                fieldId: J_Type_Id,
                value: J_History_Obj
            }, {
                dirty: true,
                fieldId: J_ParentTypeId,
                value: PD_Obj
            }, {
                dirty: true,
                fieldId: J_Type_Name,
                value: 'Journal - History'
            }
        ],
        persist: true
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                return true;
            } else {
                alert( "Cherwell add Product Deployment Journal Note: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
        }
    } catch (e) {
        alert(e);
        return false;
    }
}

function updateSM(recId, tracking, pdRecID) {
    today = new Date();
    body = { busObId:SM_Obj,
        busObRecId: recId,
        fields:[
            {   dirty: true,
                fieldId: SM_DatePacked,
                value: today }
        ],
        persist: true
    };
    try {
        if (refreshToken()) {
            $.ajaxSetup({headers:{'Authorization':"Bearer " + token.access,
                                'Content-Type':"application/json"}});
            xhr = $.ajax({
                type:"POST",
                url: "/cherwellapi/api/V1/savebusinessobject",
                data:  JSON.stringify(body),
                dataType: 'json',
                async: false
            });
            if (xhr.status == 200) {
                strMessage = "<li>Ship Manager with tracking Number " + tracking + " marked as packed today.</li>";
                $("#result").prepend(strMessage);
                addJournalNote(pdRecID, 'Date packed set.');
                return true;
            } else {
                alert( "Cherwell update the Ship Manager Date Packed: " + xhr.status + "\n" + xhr.responseText);
                return false;
            }
        }
    } catch (e) {
        alert(e);
        return false;
    }
}
