(function () {
    'use strict';
    document.getElementsByClassName("close")[0].addEventListener("click", () => { window.close() });
})();

var runtimePort = chrome.runtime.connect({
    name: location.href.replace(/\/|:|#|\?|\$|\^|%|\.|`|~|!|\+|@|\[|\||]|\|*. /g, '').split('\n').join('').split('\r').join('')
});

var recordProcessing;

runtimePort.onMessage.addListener(function (message) {
    if (!message || !message.messageFromContentScript1234) {
        return;
    }
});

var isRecording = false;



function stopRecording() {
    chrome.storage.sync.set({
        isRecording: 'false'
    }, function () {
        runtimePort.postMessage({
            messageFromContentScript1234: true,
            stopRecording: true,
            dropdown: true
        });
        window.close();
    });
};

function startRecording(time) {
    chrome.storage.sync.set({
        enableTabCaptureAPI: 'true',
        enableTabCaptureAPIAudioOnly: 'false',
        enableMicrophone: 'false',
        enableCamera: 'false',
        enableScreen: 'false',
        isRecording: 'true',
        enableSpeakers: 'false'
    }, function () {
        runtimePort.postMessage({
            messageFromContentScript1234: true,
            startRecording: true,
            dropdown: true,
            time: time
        });
        window.close();
        chrome.storage.sync.get('isRecording', function (obj) {
            isRecording = obj.isRecording === 'true';
        });
    });
}

document.getElementById('start-recording').onclick = function () {
    const path = document.getElementById('path').value;
    const consecutive = document.getElementById('consecutive').value;
    const name = document.getElementById('name').value;
    const time = document.getElementById('time').value;
    if (consecutive == '' || name == '' || time == '') {
        alert('All fileds must be filled in!');
    } else {
        chrome.storage.sync.set({
            path, consecutive, name, time
        }, function () {
            startRecording(time)
        })
    }
};

document.getElementById('stop-recording').onclick = function () {
    stopRecording();
}
