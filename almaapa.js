// ==UserScript==
// @name         Alma-apan 2
// @namespace    http://tampermonkey.net/
// @version      4.2
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

    const ADDITIONAL_ID_SELECTOR = "[id*='additionalIdadditionalId']";
    const PREFERRED_ID_SELECTOR = "[id*='prefferedIdprefferedId']";

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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

    function printList(hsselector) {

        const rows = [];

        document.querySelectorAll(hsselector + ' .recordOuterContainer').forEach(function (container) {

            // Holdshelf Number (t.ex. qljfon-001) som hämtats från API:t.
            // Faller tillbaka på additionalId om den inte hunnit laddas.
            const hsEl = container.querySelector('.kthb-hsnumber');
            const idEl = container.querySelector(ADDITIONAL_ID_SELECTOR);
            const holdshelfNumber =
                (hsEl && hsEl.textContent.trim()) ||
                (idEl && idEl.textContent.trim()) ||
                '';

            const titleEl =
                container.querySelector('.recordTitle') ||
                container.querySelector('.briefTitle') ||
                container.querySelector('a');
            const title = titleEl ? titleEl.textContent.trim() : '';

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

        // Centrera över Alma-fönstret (screenX/Y gäller även vid flera skärmar)
        const popupW = 900;
        const popupH = 700;
        const popupLeft = Math.round(window.screenX + (window.outerWidth - popupW) / 2);
        const popupTop = Math.round(window.screenY + (window.outerHeight - popupH) / 2);

        // Eget popup-fönster, tillräckligt stort för att förhandsgranskningen ska synas
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
<body><div class="heading">${heading}</div><div>${today}</div><div>====================</div>\n\n${escapeHtml(content)}</body>
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
    }

    function addExportButton(hsselector, listContainer) {

        if (document.getElementById('kthb-export-button')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'kthb-export-button';
        button.type = 'button';
        button.className = 'btn btn-secondary';
        button.title = 'Prints only Holdshelf Number and Title (receipt format)';
        button.style.margin = '10px';
        button.textContent = 'Print Holdshelf Numbers & Titles';

        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            printList(hsselector);
        });

        listContainer.prepend(button);
    }

    function fetchHoldshelfNumber(container, jwt) {

        const idEl = container.querySelector(ADDITIONAL_ID_SELECTOR);
        const prefEl = container.querySelector(PREFERRED_ID_SELECTOR);

        if (!idEl || !prefEl) {
            return;
        }

        // Elementet som Holdshelf Number läggs till i (tre nivåer upp från additionalId)
        const target = idEl.parentElement.parentElement.parentElement;

        GM_xmlhttpRequest({
            method: "GET",
            url:
                "https://api.lib.kth.se/almatools/v1/holdshelfno/" +
                prefEl.innerHTML.split('@')[0] +
                "/" +
                idEl.innerHTML,

            headers: {
                'Accept': 'text/xml',
                'Content-Type': 'text/xml',
                'Authorization': 'Bearer ' + jwt
            },

            onload: function (response) {

                if (response.status === 201) {

                    target.insertAdjacentHTML('beforeend', `
<div class="col col-xs-12 marTopBottom3">
    <span class="fieldName">Holdshelf Number:</span>
    <span class="spacer_after_1em" dir="auto">
        <span style="color:red" dir="auto" class="labelField">
            Fel!!
        </span>
    </span>
</div>`);

                    return;
                }

                const xmldoc = new DOMParser().parseFromString(
                    response.responseText,
                    "text/xml"
                );

                const textOf = function (path) {
                    const node = xmldoc.evaluate(
                        path,
                        xmldoc,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;
                    return node && node.childNodes[0]
                        ? node.childNodes[0].nodeValue
                        : '';
                };

                const holdshelfnumber = textOf("/holdshelfnumber/holdshelfnumber");
                const userid_encrypted = textOf("/holdshelfnumber/userid_encrypted");

                target.insertAdjacentHTML('beforeend', `
<div class="col col-xs-12 marTopBottom3">
    <span class="fieldName">
        Holdshelf Number:
    </span>
    <span class="spacer_after_1em" dir="auto">
        <span dir="auto" class="labelField kthb-hsnumber">
            ${userid_encrypted}-${holdshelfnumber}
        </span>
    </span>
</div>`);
            },

            onerror: function (error) {
                console.log(error);
            }
        });
    }

    async function init() {

        let hsselector;

        if (document.title === 'Expired Hold Shelf Items') {
            hsselector = "#expiredHoldShelfRequestsList";
        } else if (document.title === 'Active Hold Shelf Items') {
            hsselector = "#activeHoldShelfRequestsList";
        } else {
            return;
        }

        const listContainer = document.querySelector(hsselector + ' .recordListContainer');

        if (!listContainer || listContainer.classList.contains('kthb-processed')) {
            return;
        }

        listContainer.classList.add('kthb-processed');

        addExportButton(hsselector, listContainer);

        try {
            const almaAuthToken = await gettoken();
            const jwt = JSON.parse(almaAuthToken).jwt;

            document.querySelectorAll(hsselector + ' .recordOuterContainer').forEach(function (container) {
                fetchHoldshelfNumber(container, jwt);
            });
        } catch (error) {
            console.log(error);
        }
    }

    // Ersätter jQuery:s ajaxComplete: kör init när sidan ändras (med liten fördröjning)
    let timer = null;
    const observer = new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(init, 200);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    init();

})();
