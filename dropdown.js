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
    if (path == '' || consecutive == '' || name == '' || time == '') {
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
    // chrome.storage.sync.get('isRecording', function (obj) {
    //     isRecording = obj.isRecording === 'true';
    //     if (isRecording === true) {
            stopRecording();

            // chrome.tabs.query({}, function (tabs) {
            //     var tabIds = [];
            //     var url = 'chrome-extension://' + chrome.runtime.id + '/video.html';
            //     for (var i = tabs.length - 1; i >= 0; i--) {
            //         if (tabs[i].url === url) {
            //             tabIds.push(tabs[i].id);
            //             chrome.tabs.update(tabs[i].id, {
            //                 active: true,
            //                 url: url
            //             });
            //             break;
            //         }
            //     }
            //     if (tabIds.length) {
            //         chrome.tabs.remove(tabIds);
            //     }
            // });
        // }
    // });

}

// document.getElementById('full-screen').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'false',
//         enableCamera: 'false',
//         enableScreen: 'true',
//         isRecording: 'true',
//         enableSpeakers: 'false'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('full-screen-audio').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'false',
//         enableCamera: 'false',
//         enableScreen: 'true',
//         isRecording: 'true',
//         enableSpeakers: 'true'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('full-screen-microphone-audio').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'true',
//         enableCamera: 'false',
//         enableScreen: 'true',
//         isRecording: 'true',
//         enableSpeakers: 'true'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };



// document.getElementById('selected-tab-audio-only').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'true',
//         enableTabCaptureAPIAudioOnly: 'true',
//         enableMicrophone: 'false',
//         enableCamera: 'false',
//         enableScreen: 'false',
//         isRecording: 'true',
//         enableSpeakers: 'false'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('microphone-screen').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'true',
//         enableCamera: 'false',
//         enableScreen: 'true',
//         isRecording: 'true',
//         enableSpeakers: 'false'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('microphone-screen-camera').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'true',
//         enableCamera: 'true',
//         enableScreen: 'true',
//         isRecording: 'true',
//         enableSpeakers: 'false'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('microphone-webcam').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'true',
//         enableCamera: 'true',
//         enableScreen: 'false',
//         isRecording: 'true',
//         enableSpeakers: 'false'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('microphone-speakers').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'true',
//         enableCamera: 'false',
//         enableScreen: 'false',
//         isRecording: 'true',
//         enableSpeakers: 'true'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('microphone-only').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'true',
//         enableCamera: 'false',
//         enableScreen: 'false',
//         isRecording: 'true',
//         enableSpeakers: 'false'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('speakers-only').onclick = function() {
//     chrome.storage.sync.set({
//         enableTabCaptureAPI: 'false',
//         enableTabCaptureAPIAudioOnly: 'false',
//         enableMicrophone: 'false',
//         enableCamera: 'false',
//         enableScreen: 'false',
//         isRecording: 'true',
//         enableSpeakers: 'true'
//     }, function() {
//         runtimePort.postMessage({
//             messageFromContentScript1234: true,
//             startRecording: true,
//             dropdown: true
//         });
//         window.close();
//     });
// };

// document.getElementById('btn-options').onclick = function(e) {
//     e.preventDefault();
//     location.href = this.href;
// };
