// ==UserScript==
// @name         Alma-apan 2
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Diverse addons för Alma. Hold Shelf Number + utskriftslista
// @author       Thomas Lind
// @updateURL    https://github.com/kth-biblioteket/kthb-almaapa-tampermonkey/raw/main/almaapa.js
// @downloadURL  https://github.com/kth-biblioteket/kthb-almaapa-tampermonkey/raw/main/almaapa.js
// @include      https://eu01.alma.exlibrisgroup.com*
// @include      https://eu01-psb.alma.exlibrisgroup.com*
// @include      https://kth-ch.alma.exlibrisgroup.com*
// @include      https://kth-ch-psb.alma.exlibrisgroup.com*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      lib.kth.se
// @connect      ref.lib.kth.se
// @connect      kth-ch-psb.alma.exlibrisgroup.com
// @connect      kth-ch.alma.exlibrisgroup.com
// ==/UserScript==

(function () {
    'use strict';

    // Kvittopapper: 80 mm rulle (använd 58 för smal rulle)
    const PAPER_WIDTH_MM = 80;
    const PAPER_MARGIN_MM = 2;

    function processOnce(selector, fn) {
        if (!$(selector).hasClass('kthb-processed')) {
            fn();
            $(selector).addClass('kthb-processed');
        }
    }

    function gettoken() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://" + window.location.hostname +
                     "/internal/airapi/cloudapps/%21~expired-holdshelf/jwt?_=" +
                     new Date().getTime(),
                headers: {
                    'Content-Type': 'application/json'
                },
                onload: function (response) {
                    if (response.status === 201 || response.status === 401) {
                        reject(response.status);
                    } else {
                        resolve(response.responseText);
                    }
                },
                onerror: function (error) {
                    reject(error);
                }
            });
        });
    }

    function addExportButton(hsselector) {

        if ($("#kthb-export-button").length) {
            return;
        }

        const button = $(`
            <button
                id="kthb-export-button"
                type="button"
                class="btn btn-secondary"
                title="Prints only Holdshelf Number and Title (receipt format)"
                style="margin:10px;">
                Print Holdshelf Numbers &amp; Titles
            </button>
        `);

        button.on("click", function (e) {

            e.preventDefault();
            e.stopPropagation();

            const rows = [];

            $(hsselector).find('.recordOuterContainer').each(function () {

                // Holdshelf Number (t.ex. qljfon-001) som hämtats från API:t.
                // Faller tillbaka på additionalId om den inte hunnit laddas.
                const holdshelfNumber =
                    $(this).find(".kthb-hsnumber").first().text().trim() ||
                    $(this)
                        .find("[id*='additionalIdadditionalId']")
                        .text()
                        .trim();

                let title =
                    $(this).find(".recordTitle").first().text().trim() ||
                    $(this).find(".briefTitle").first().text().trim() ||
                    $(this).find("a").first().text().trim();

                rows.push({
                    holdshelfNumber,
                    title: title.substring(0, 20)
                });
            });

            const heading = document.title === 'Active Hold Shelf Items'
                ? 'Active Hold Shelf'
                : 'Expired Hold Shelf';
            const today = new Date().toLocaleDateString('sv-SE'); // ÅÅÅÅ-MM-DD

            const content = rows.map(r =>
`${r.holdshelfNumber}
${r.title}
--------------------`
            ).join('\n\n');

            // Eget popup-fönster, tillräckligt stort för att förhandsgranskningen ska synas
            // Centrera över Alma-fönstret (screenX/Y gäller även vid flera skärmar)
            const popupW = 900;
            const popupH = 700;
            const popupLeft = Math.round(window.screenX + (window.outerWidth - popupW) / 2);
            const popupTop = Math.round(window.screenY + (window.outerHeight - popupH) / 2);

            const printWindow = window.open(
                '',
                'kthbPrint',
                `popup=yes,width=${popupW},height=${popupH},left=${popupLeft},top=${popupTop}`
            );

            if (!printWindow) {
                alert('Popup blockerades. Tillåt popup-fönster för Alma.');
                return;
            }

            printWindow.document.write(`
<html>
<head>
<title>Hold Shelf</title>
<style>
@page {
    size: ${PAPER_WIDTH_MM}mm auto;
    margin: ${PAPER_MARGIN_MM}mm;
}

html, body {
    margin: 0;
    padding: 0;
}

body {
    width: ${PAPER_WIDTH_MM - 2 * PAPER_MARGIN_MM}mm;
    font-family: monospace;
    font-size: 10pt;
    white-space: pre-wrap;
}

.heading {
    font-size: 16pt;
    font-weight: bold;
}
</style>
</head>
<body><div class="heading">${heading}</div><div>${today}</div><div>====================</div>\n\n${content}</body>
</html>
            `);

            printWindow.document.close();

            // Sätts före print() eftersom print() blockerar tills dialogen stängs
            printWindow.onafterprint = function () {
                printWindow.close();
            };

            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 300);
        });

        $(hsselector + " .recordListContainer").prepend(button);
    }

    async function init() {

        let hsselector;

        if (
            document.title !== 'Expired Hold Shelf Items' &&
            document.title !== 'Active Hold Shelf Items'
        ) {
            return false;
        }

        if (document.title === 'Expired Hold Shelf Items') {
            hsselector = "#expiredHoldShelfRequestsList";
        }

        if (document.title === 'Active Hold Shelf Items') {
            hsselector = "#activeHoldShelfRequestsList";
        }

        processOnce(hsselector + ' .recordListContainer', async function () {

            addExportButton(hsselector);

            let userid_encrypted;
            let holdshelfnumber;
            let holdshelfnumberhtml;

            const almaAuthToken = await gettoken();
            const almaAuthTokenjsonObj = JSON.parse(almaAuthToken);

            $(hsselector).find('.recordOuterContainer').each(function () {

                const thiz = this;

                GM_xmlhttpRequest({
                    method: "GET",
                    url:
                        "https://api.lib.kth.se/almatools/v1/holdshelfno/" +
                        $(this)
                            .find("[id*='prefferedIdprefferedId']")
                            .html()
                            .split('@')[0] +
                        "/" +
                        $(this)
                            .find("[id*='additionalIdadditionalId']")
                            .html(),

                    headers: {
                        'Accept': 'text/xml',
                        'Content-Type': 'text/xml',
                        'Authorization': 'Bearer ' + almaAuthTokenjsonObj.jwt
                    },

                    onload: function (response) {

                        if (response.status === 201) {

                            const html = `
<div class="col col-xs-12 marTopBottom3">
    <span class="fieldName">Holdshelf Number:</span>
    <span class="spacer_after_1em" dir="auto">
        <span style="color:red" dir="auto" class="labelField">
            Fel!!
        </span>
    </span>
</div>`;

                            $(thiz)
                                .find("[id*='additionalIdadditionalId']")
                                .parent()
                                .parent()
                                .parent()
                                .append(html);

                            return;
                        }

                        const parser = new DOMParser();
                        const xmldoc = parser.parseFromString(
                            response.responseText,
                            "text/xml"
                        );

                        let path = "/holdshelfnumber/holdshelfnumber";

                        const holdshelfnumberxml =
                            xmldoc.evaluate(
                                path,
                                xmldoc,
                                null,
                                XPathResult.ANY_TYPE,
                                null
                            );

                        let result =
                            holdshelfnumberxml.iterateNext();

                        while (result) {
                            holdshelfnumber =
                                result.childNodes[0].nodeValue;
                            result =
                                holdshelfnumberxml.iterateNext();
                        }

                        path = "/holdshelfnumber/userid_encrypted";

                        const useridxml =
                            xmldoc.evaluate(
                                path,
                                xmldoc,
                                null,
                                XPathResult.ANY_TYPE,
                                null
                            );

                        result =
                            useridxml.iterateNext();

                        while (result) {
                            userid_encrypted =
                                result.childNodes[0].nodeValue;
                            result =
                                useridxml.iterateNext();
                        }

                        holdshelfnumberhtml = `
<div class="col col-xs-12 marTopBottom3">
    <span class="fieldName">
        Holdshelf Number:
    </span>
    <span class="spacer_after_1em" dir="auto">
        <span dir="auto" class="labelField kthb-hsnumber">
            ${userid_encrypted}-${holdshelfnumber}
        </span>
    </span>
</div>`;

                        $(thiz)
                            .find("[id*='additionalIdadditionalId']")
                            .parent()
                            .parent()
                            .parent()
                            .append(holdshelfnumberhtml);
                    },

                    onerror: function (error) {
                        console.log(error);
                    }
                });
            });
        });

        return true;
    }

    $(document).ajaxComplete(init);

})();
