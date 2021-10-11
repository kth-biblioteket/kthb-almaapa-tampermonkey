// ==UserScript==
// @name         Hold Shelf Number
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Hold Shelf Number
// @author       Thomas Lind
// @include      https://eu01.alma.exlibrisgroup.com*
// @include      https://kth-ch-psb.alma.exlibrisgroup.com*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      lib.kth.se
// ==/UserScript==

(function() {
    'use strict';
    /* globals $ */
    function handleError (err) {
        window.prompt('Ett fel uppstod!', err.message);
    }

    function processOnce (selector, fn) {
        if (!$(selector).hasClass('kthb-processed')) {
            fn();
            $(selector).addClass('kthb-processed');
        }
    }

    function wait (fn) {
        $('body').ajaxComplete(function (e) {
            try {
                $(e.currentTarget).off('ajaxComplete');
                return fn();
            } catch (err) {
                return true;
            }
        });
    }

    function init () {
        var userid_encrypted
        var holdshelfnumber
        var holdshelfnumberhtml;
        var hsselector;
        var html;
        //Utför om aktuell alma-sida är hold shelf
        if (document.title == 'Expired Hold Shelf Items' || document.title == 'Active Hold Shelf Items') {
            if (document.title == 'Expired Hold Shelf Items') {
                hsselector = "#expiredHoldShelfRequestsList";
            }
            if (document.title == 'Active Hold Shelf Items') {
                hsselector = "#activeHoldShelfRequestsList";
            }
            //Se till att proceduren bara utförs en gång
            processOnce(hsselector + ' .recordListContainer', function () {
                $(hsselector).find('.recordOuterContainer').each(function() {
                    var thiz = this;
                    //Anropa api med userid och additional id som parametrar
                    GM_xmlhttpRequest ({
                        method: "GET",
                        url: "https://lib.kth.se/holdshelfno/api/v1/" + $(this).find("[id*='prefferedIdprefferedId']").html().split('@')[0] + "/" + $(this).find("[id*='additionalIdadditionalId']").html() + "/?token=xxxxxxxxxxxx",
                        headers: {
                            'Accept': 'text/xml',
                            'Content-Type': 'text/xml',
                        },
                        onload: function(response) {
                            if (response.status == 201) {
                                html = `<div class="col col-xs-12 marTopBottom3">
                                    <span class="fieldName">
                                       Holdshelf Number:
                                    </span>
                                       <span class="spacer_after_1em" dir="auto">
                                          <span style="color:red" title="" dir="auto" class="labelField">
                                             Fel!!
                                       </span>
                                    </span>
                                    </div>`;
                                $(thiz).find("[id*='additionalIdadditionalId']").parent().parent().parent().append(html)
                            } else {
                                var parser = new DOMParser();
                                var xmldoc = parser.parseFromString(response.responseText, "text/xml");
                                //Läs in holdshelfnummer
                                var path = "/holdshelfnumber/holdshelfnumber";
                                var holdshelfnumberxml = xmldoc.evaluate(path, xmldoc, null, XPathResult.ANY_TYPE, null);
                                var result = holdshelfnumberxml.iterateNext();
                                while (result) {
                                    holdshelfnumber = result.childNodes[0].nodeValue;
                                    result = holdshelfnumberxml.iterateNext();
                                }
                                //Läs in "krypterat" userid
                                path = "/holdshelfnumber/userid_encrypted";
                                var userid_encryptedxml = xmldoc.evaluate(path, xmldoc, null, XPathResult.ANY_TYPE, null);
                                result = userid_encryptedxml.iterateNext();
                                while (result) {
                                    userid_encrypted = result.childNodes[0].nodeValue;
                                    result = userid_encryptedxml.iterateNext();
                                }
                                //Skapa html och lägg in på respektive post
                                holdshelfnumberhtml =
                                     `<div class="col col-xs-12 marTopBottom3">
                                    <span class="fieldName">
                                       Holdshelf Number:
                                    </span>
                                    <span class="spacer_after_1em" dir="auto">
                                       <span dir="auto" class="labelField">`
                                          + userid_encrypted + holdshelfnumber +
                                       `</span>
                                    </span>
                                    </div>`
                                $(thiz).find("[id*='additionalIdadditionalId']").parent().parent().parent().append(holdshelfnumberhtml)
                                return 1;
                            }
                        },
                        onerror: function(error) {
                        }
                    });
                });
            })
        } else {
           return false;
        }
        return true;
    }

    //init();
    $(document).ajaxComplete(init);
})();