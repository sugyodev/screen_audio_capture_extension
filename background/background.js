// ______________________
// MediaStreamRecorder.js

/**
 * MediaStreamRecorder is an abstraction layer for {@link https://w3c.github.io/mediacapture-record/MediaRecorder.html|MediaRecorder API}. It is used by {@link RecordRTC} to record MediaStream(s) in both Chrome and Firefox.
 * @summary Runs top over {@link https://w3c.github.io/mediacapture-record/MediaRecorder.html|MediaRecorder API}.
 * @license {@link https://github.com/muaz-khan/RecordRTC#license|MIT}
 * @author {@link https://github.com/muaz-khan|Muaz Khan}
 * @typedef MediaStreamRecorder
 * @class
 * @example
 * var config = {
 *     mimeType: 'video/webm', // vp8, vp9, h264, mkv, opus/vorbis
 *     audioBitsPerSecond : 256 * 8 * 1024,
 *     videoBitsPerSecond : 256 * 8 * 1024,
 *     bitsPerSecond: 256 * 8 * 1024,  // if this is provided, skip above two
 *     checkForInactiveTracks: true,
 *     timeSlice: 1000, // concatenate intervals based blobs
 *     ondataavailable: function() {} // get intervals based blobs
 * }
 * var recorder = new MediaStreamRecorder(mediaStream, config);
 * recorder.record();
 * recorder.stop(function(blob) {
 *     video.src = URL.createObjectURL(blob);
 *
 *     // or
 *     var blob = recorder.blob;
 * });
 * @see {@link https://github.com/muaz-khan/RecordRTC|RecordRTC Source Code}
 * @param {MediaStream} mediaStream - MediaStream object fetched using getUserMedia API or generated using captureStreamUntilEnded or WebAudio API.
 * @param {object} config - {disableLogs:true, initCallback: function, mimeType: "video/webm", timeSlice: 1000}
 * @throws Will throw an error if first argument "MediaStream" is missing. Also throws error if "MediaRecorder API" are not supported by the browser.
 */

function MediaStreamRecorder(mediaStream, config) {
    var self = this;

    if (typeof mediaStream === 'undefined') {
        throw 'First argument "MediaStream" is required.';
    }

    if (typeof MediaRecorder === 'undefined') {
        throw 'Your browser does not supports Media Recorder API. Please try other modules e.g. WhammyRecorder or StereoAudioRecorder.';
    }

    config = config || {
        // bitsPerSecond: 256 * 8 * 1024,
        mimeType: 'video/webm'
    };

    if (config.type === 'audio') {
        if (getTracks(mediaStream, 'video').length && getTracks(mediaStream, 'audio').length) {
            var stream;
            if (!!navigator.mozGetUserMedia) {
                stream = new MediaStream();
                stream.addTrack(getTracks(mediaStream, 'audio')[0]);
            } else {
                // webkitMediaStream
                stream = new MediaStream(getTracks(mediaStream, 'audio'));
            }
            mediaStream = stream;
        }

        if (!config.mimeType || config.mimeType.toString().toLowerCase().indexOf('audio') === -1) {
            config.mimeType = isChrome ? 'audio/webm' : 'audio/ogg';
        }

        if (config.mimeType && config.mimeType.toString().toLowerCase() !== 'audio/ogg' && !!navigator.mozGetUserMedia) {
            // forcing better codecs on Firefox (via #166)
            config.mimeType = 'audio/ogg';
        }
    }

    var arrayOfBlobs = [];

    /**
     * This method returns array of blobs. Use only with "timeSlice". Its useful to preview recording anytime, without using the "stop" method.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * var arrayOfBlobs = recorder.getArrayOfBlobs();
     * @returns {Array} Returns array of recorded blobs.
     */
    this.getArrayOfBlobs = function() {
        return arrayOfBlobs;
    };

    /**
     * This method records MediaStream.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * recorder.record();
     */
    this.record = function() {
        // set defaults
        self.blob = null;
        self.clearRecordedData();
        self.timestamps = [];
        allStates = [];
        arrayOfBlobs = [];

        var recorderHints = config;

        if (!config.disableLogs) {
            // console.log('Passing following config over MediaRecorder API.', recorderHints);
        }

        if (mediaRecorder) {
            // mandatory to make sure Firefox doesn't fails to record streams 3-4 times without reloading the page.
            mediaRecorder = null;
        }

        if (isChrome && !isMediaRecorderCompatible()) {
            // to support video-only recording on stable
            recorderHints = 'video/vp8';
        }

        if (typeof MediaRecorder.isTypeSupported === 'function' && recorderHints.mimeType) {
            if (!MediaRecorder.isTypeSupported(recorderHints.mimeType)) {
                if (!config.disableLogs) {
                    console.warn('MediaRecorder API seems unable to record mimeType:', recorderHints.mimeType);
                }

                recorderHints.mimeType = config.type === 'audio' ? 'audio/webm' : 'video/webm';
            }
        }

        // using MediaRecorder API here
        try {
            mediaRecorder = new MediaRecorder(mediaStream, recorderHints);

            // reset
            config.mimeType = recorderHints.mimeType;
        } catch (e) {
            // chrome-based fallback
            mediaRecorder = new MediaRecorder(mediaStream);
        }

        // old hack?
        if (recorderHints.mimeType && !MediaRecorder.isTypeSupported && 'canRecordMimeType' in mediaRecorder && mediaRecorder.canRecordMimeType(recorderHints.mimeType) === false) {
            if (!config.disableLogs) {
                console.warn('MediaRecorder API seems unable to record mimeType:', recorderHints.mimeType);
            }
        }

        // Dispatching OnDataAvailable Handler
        mediaRecorder.ondataavailable = function(e) {
            if (e.data) {
                allStates.push('ondataavailable: ' + bytesToSize(e.data.size));
            }

            if (typeof config.timeSlice === 'number') {
                if (e.data && e.data.size && e.data.size > 100) {
                    arrayOfBlobs.push(e.data);
                    updateTimeStamp();

                    if (typeof config.ondataavailable === 'function') {
                        // intervals based blobs
                        var blob = config.getNativeBlob ? e.data : new Blob([e.data], {
                            type: getMimeType(recorderHints)
                        });
                        config.ondataavailable(blob);
                    }
                }
                return;
            }

            if (!e.data || !e.data.size || e.data.size < 100 || self.blob) {
                // make sure that stopRecording always getting fired
                // even if there is invalid data
                if (self.recordingCallback) {
                    self.recordingCallback(new Blob([], {
                        type: getMimeType(recorderHints)
                    }));
                    self.recordingCallback = null;
                }
                return;
            }

            self.blob = config.getNativeBlob ? e.data : new Blob([e.data], {
                type: getMimeType(recorderHints)
            });

            if (self.recordingCallback) {
                self.recordingCallback(self.blob);
                self.recordingCallback = null;
            }
        };

        mediaRecorder.onstart = function() {
            allStates.push('started');
        };

        mediaRecorder.onpause = function() {
            allStates.push('paused');
        };

        mediaRecorder.onresume = function() {
            allStates.push('resumed');
        };

        mediaRecorder.onstop = function() {
            allStates.push('stopped');
        };

        mediaRecorder.onerror = function(error) {
            if (!error) {
                return;
            }

            if (!error.name) {
                error.name = 'UnknownError';
            }

            allStates.push('error: ' + error);

            if (!config.disableLogs) {
                // via: https://w3c.github.io/mediacapture-record/MediaRecorder.html#exception-summary
                if (error.name.toString().toLowerCase().indexOf('invalidstate') !== -1) {
                    console.error('The MediaRecorder is not in a state in which the proposed operation is allowed to be executed.', error);
                } else if (error.name.toString().toLowerCase().indexOf('notsupported') !== -1) {
                    console.error('MIME type (', recorderHints.mimeType, ') is not supported.', error);
                } else if (error.name.toString().toLowerCase().indexOf('security') !== -1) {
                    console.error('MediaRecorder security error', error);
                }

                // older code below
                else if (error.name === 'OutOfMemory') {
                    console.error('The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.', error);
                } else if (error.name === 'IllegalStreamModification') {
                    console.error('A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.', error);
                } else if (error.name === 'OtherRecordingError') {
                    console.error('Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.', error);
                } else if (error.name === 'GenericError') {
                    console.error('The UA cannot provide the codec or recording option that has been requested.', error);
                } else {
                    console.error('MediaRecorder Error', error);
                }
            }

            (function(looper) {
                if (!self.manuallyStopped && mediaRecorder && mediaRecorder.state === 'inactive') {
                    delete config.timeslice;

                    // 10 minutes, enough?
                    mediaRecorder.start(10 * 60 * 1000);
                    return;
                }

                setTimeout(looper, 1000);
            })();

            if (mediaRecorder.state !== 'inactive' && mediaRecorder.state !== 'stopped') {
                mediaRecorder.stop();
            }
        };

        if (typeof config.timeSlice === 'number') {
            updateTimeStamp();
            mediaRecorder.start(config.timeSlice);
        } else {
            // default is 24 hours; enough? (thanks https://github.com/slidevjs/slidev/pull/488)
            // use config => {timeSlice: 1000} otherwise

            mediaRecorder.start(24 * 60 * 60 * 1000);
        }

        if (config.initCallback) {
            config.initCallback(); // old code
        }
    };

    /**
     * @property {Array} timestamps - Array of time stamps
     * @memberof MediaStreamRecorder
     * @example
     * console.log(recorder.timestamps);
     */
    this.timestamps = [];

    function updateTimeStamp() {
        self.timestamps.push(new Date().getTime());

        if (typeof config.onTimeStamp === 'function') {
            config.onTimeStamp(self.timestamps[self.timestamps.length - 1], self.timestamps);
        }
    }

    function getMimeType(secondObject) {
        if (mediaRecorder && mediaRecorder.mimeType) {
            return mediaRecorder.mimeType;
        }

        return secondObject.mimeType || 'video/webm';
    }

    /**
     * This method stops recording MediaStream.
     * @param {function} callback - Callback function, that is used to pass recorded blob back to the callee.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * recorder.stop(function(blob) {
     *     video.src = URL.createObjectURL(blob);
     * });
     */
    this.stop = function(callback) {
        callback = callback || function() {};

        self.manuallyStopped = true; // used inside the mediaRecorder.onerror

        if (!mediaRecorder) {
            return;
        }

        this.recordingCallback = callback;

        if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }

        if (typeof config.timeSlice === 'number') {
            setTimeout(function() {
                self.blob = new Blob(arrayOfBlobs, {
                    type: getMimeType(config)
                });

                self.recordingCallback(self.blob);
            }, 100);
        }
    };

    /**
     * This method pauses the recording process.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * recorder.pause();
     */
    this.pause = function() {
        if (!mediaRecorder) {
            return;
        }

        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
        }
    };

    /**
     * This method resumes the recording process.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * recorder.resume();
     */
    this.resume = function() {
        if (!mediaRecorder) {
            return;
        }

        if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
        }
    };

    /**
     * This method resets currently recorded data.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * recorder.clearRecordedData();
     */
    this.clearRecordedData = function() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            self.stop(clearRecordedDataCB);
        }

        clearRecordedDataCB();
    };

    function clearRecordedDataCB() {
        arrayOfBlobs = [];
        mediaRecorder = null;
        self.timestamps = [];
    }

    // Reference to "MediaRecorder" object
    var mediaRecorder;

    /**
     * Access to native MediaRecorder API
     * @method
     * @memberof MediaStreamRecorder
     * @instance
     * @example
     * var internal = recorder.getInternalRecorder();
     * internal.ondataavailable = function() {}; // override
     * internal.stream, internal.onpause, internal.onstop, etc.
     * @returns {Object} Returns internal recording object.
     */
    this.getInternalRecorder = function() {
        return mediaRecorder;
    };

    function isMediaStreamActive() {
        if ('active' in mediaStream) {
            if (!mediaStream.active) {
                return false;
            }
        } else if ('ended' in mediaStream) { // old hack
            if (mediaStream.ended) {
                return false;
            }
        }
        return true;
    }

    /**
     * @property {Blob} blob - Recorded data as "Blob" object.
     * @memberof MediaStreamRecorder
     * @example
     * recorder.stop(function() {
     *     var blob = recorder.blob;
     * });
     */
    this.blob = null;


    /**
     * Get MediaRecorder readonly state.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * var state = recorder.getState();
     * @returns {String} Returns recording state.
     */
    this.getState = function() {
        if (!mediaRecorder) {
            return 'inactive';
        }

        return mediaRecorder.state || 'inactive';
    };

    // list of all recording states
    var allStates = [];

    /**
     * Get MediaRecorder all recording states.
     * @method
     * @memberof MediaStreamRecorder
     * @example
     * var state = recorder.getAllStates();
     * @returns {Array} Returns all recording states
     */
    this.getAllStates = function() {
        return allStates;
    };

    // if any Track within the MediaStream is muted or not enabled at any time, 
    // the browser will only record black frames 
    // or silence since that is the content produced by the Track
    // so we need to stopRecording as soon as any single track ends.
    if (typeof config.checkForInactiveTracks === 'undefined') {
        config.checkForInactiveTracks = false; // disable to minimize CPU usage
    }

    var self = this;

    // this method checks if media stream is stopped
    // or if any track is ended.
    (function looper() {
        if (!mediaRecorder || config.checkForInactiveTracks === false) {
            return;
        }

        if (isMediaStreamActive() === false) {
            if (!config.disableLogs) {
                console.log('MediaStream seems stopped.');
            }
            self.stop();
            return;
        }

        setTimeout(looper, 1000); // check every second
    })();

    // for debugging
    this.name = 'MediaStreamRecorder';
    this.toString = function() {
        return this.name;
    };
}

if (typeof RecordRTC !== 'undefined') {
    RecordRTC.MediaStreamRecorder = MediaStreamRecorder;
}



var recorder;
var isRecording = false;
var bitsPerSecond = 0;
var isChrome = true; // used by RecordRTC

var enableTabCaptureAPI = false;
var enableTabCaptureAPIAudioOnly = false;

var enableScreen = true;
var enableMicrophone = false;
var enableCamera = false;
var cameraStream = false;

var enableSpeakers = true;

var videoCodec = 'Default';
var videoMaxFrameRates = '';
var videoResolutions = '1920x1080';

var startedVODRecordedAt = (new Date).getTime();

var startRecordingCallback = function() {};
var stopRecordingCallback = function(file) {};
var openPreviewOnStopRecording = true;
var openCameraPreviewDuringRecording = true;

var fixVideoSeekingIssues = false;

var videoPlayers = [];

function initVideoPlayer(stream) {
    var videoPlayer = document.createElement('video');
    videoPlayer.muted = !enableTabCaptureAPI;
    videoPlayer.volume = !!enableTabCaptureAPI;
    videoPlayer.srcObject = stream;

    videoPlayers.push(videoPlayer);
}


function isMediaRecorderCompatible() {
    return true;
}

function isMimeTypeSupported(mimeType) {
    if (typeof MediaRecorder.isTypeSupported !== 'function') {
        return true;
    }

    return MediaRecorder.isTypeSupported(mimeType);
}


function setVODRecordingBadgeText(text, title) {
    chrome.browserAction.setBadgeBackgroundColor({
        color: [203, 0, 15, 255]
    });

    chrome.browserAction.setBadgeText({
        text: text
    });

    chrome.browserAction.setTitle({
        title: title && title.length ? title + ' duration' : 'Record Screen'
    });
}

function msToTime(s) {
    function addZ(n) {
        return (n < 10 ? '0' : '') + n;
    }

    var ms = s % 1000;
    s = (s - ms) / 1000;
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;

    return addZ(hrs) + ':' + addZ(mins) + ':' + addZ(secs) + '.' + ms;
}

function convertTime(miliseconds) {
    var totalSeconds = Math.floor(miliseconds / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds - minutes * 60;

    minutes += '';
    seconds += '';

    if (minutes.length === 1) {
        // minutes = '0' + minutes;
    }

    if (seconds.length === 1) {
        seconds = '0' + seconds;
    }

    return minutes + ':' + seconds;
}


var initialTime, timer;

function checkTime() {
    if (!initialTime || !isRecording) return;
    var timeDifference = Date.now() - initialTime;
    var formatted = convertTime(timeDifference);
    setBadgeText(formatted);

    chrome.browserAction.setTitle({
        title: 'Recording duration: ' + formatted
    });
}

function setBadgeText(text) {
    chrome.browserAction.setBadgeBackgroundColor({
        color: [255, 0, 0, 255]
    });

    chrome.browserAction.setBadgeText({
        text: text + ''
    });
}


var images = ['recordRTC-progress-1.png', 'recordRTC-progress-2.png', 'recordRTC-progress-3.png', 'recordRTC-progress-4.png', 'recordRTC-progress-5.png'];
var imgIndex = 0;
var reverse = false;

function onRecording() {
    if(!isRecording) return;
    
    chrome.browserAction.setIcon({
        path: 'images/' + images[imgIndex]
    });

    if (!reverse) {
        imgIndex++;

        if (imgIndex > images.length - 1) {
            imgIndex = images.length - 1;
            reverse = true;
        }
    } else {
        imgIndex--;

        if (imgIndex < 0) {
            imgIndex = 1;
            reverse = false;
        }
    }

    if (isRecording) {
        setTimeout(onRecording, 800);
        return;
    }

    chrome.browserAction.setIcon({
        path: 'images/main-icon.png'
    });
}


function bytesToSize(bytes) {
    var k = 1000;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) {
        return '0 Bytes';
    }
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(k)), 10);
    return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
}

var Storage = {};

if (typeof AudioContext !== 'undefined') {
    Storage.AudioContext = AudioContext;
} else if (typeof webkitAudioContext !== 'undefined') {
    Storage.AudioContext = webkitAudioContext;
}

MediaStream.prototype.stop = function() {
    this.getTracks().forEach(function(track) {
        track.stop();
    });
};

function getRandomString() {
    if (window.crypto && window.crypto.getRandomValues && navigator.userAgent.indexOf('Safari') === -1) {
        var a = window.crypto.getRandomValues(new Uint32Array(3)),
            token = '';
        for (var i = 0, l = a.length; i < l; i++) {
            token += a[i].toString(36);
        }
        return token;
    } else {
        return (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
    }
}

function getFileName(fileExtension) {
    var str = getRandomString();
    str = str.substr(0, 5);
    return (new Date).toLocaleDateString().replace(/\//g,'-') + '-' + str + '.' + fileExtension;
}

function addStreamStopListener(stream, callback) {
    var streamEndedEvent = 'ended';
    if ('oninactive' in stream && !('onended' in stream)) {
        streamEndedEvent = 'inactive';
    }
    stream.addEventListener(streamEndedEvent, function() {
        callback();
        callback = function() {};
    });
    getTracks(stream, 'audio').forEach(function(track) {
        track.addEventListener(streamEndedEvent, function() {
            callback();
            callback = function() {};
        });
    });
    getTracks(stream, 'video').forEach(function(track) {
        track.addEventListener(streamEndedEvent, function() {
            callback();
            callback = function() {};
        });
    });
}

function getMixedAudioStream(arrayOfMediaStreams) {
    // via: @pehrsons
    if(typeof Storage === 'undefined') {
        window.Storage = {
            AudioContextConstructor: null,
            AudioContext: window.AudioContext || window.webkitAudioContext
        };
    }

    if (!Storage.AudioContextConstructor) {
        Storage.AudioContextConstructor = new Storage.AudioContext();
    }

    var context = Storage.AudioContextConstructor;

    var audioSources = [];

    var gainNode = context.createGain();
    gainNode.connect(context.destination);
    gainNode.gain.value = 0; // don't hear self

    var audioTracksLength = 0;
    arrayOfMediaStreams.forEach(function(stream) {
        if (!getTracks(stream, 'audio').length) {
            return;
        }

        audioTracksLength++;

        var audioSource = context.createMediaStreamSource(stream);
        audioSource.connect(gainNode);
        audioSources.push(audioSource);
    });

    if (!audioTracksLength) {
        return;
    }

    mediaStremDestination = context.createMediaStreamDestination();
    audioSources.forEach(function(audioSource) {
        audioSource.connect(mediaStremDestination);
    });

    return mediaStremDestination.stream;
}

function getTracks(stream, kind) {
    if (!stream || !stream.getTracks) {
        return [];
    }

    return stream.getTracks().filter(function(t) {
        return t.kind === (kind || 'audio');
    });
}

function getSeekableBlob(inputBlob, callback) {
    // EBML.js copyrights goes to: https://github.com/legokichi/ts-ebml
    if (typeof EBML === 'undefined') {
        throw new Error('Please link: https://cdn.webrtc-experiment.com/EBML.js');
    }

    var reader = new EBML.Reader();
    var decoder = new EBML.Decoder();
    var tools = EBML.tools;

    var fileReader = new FileReader();
    fileReader.onload = function(e) {
        var ebmlElms = decoder.decode(this.result);
        ebmlElms.forEach(function(element) {
            reader.read(element);
        });
        reader.stop();
        var refinedMetadataBuf = tools.makeMetadataSeekable(reader.metadatas, reader.duration, reader.cues);
        var body = this.result.slice(reader.metadataSize);
        var newBlob = new Blob([refinedMetadataBuf, body], {
            type: 'video/webm'
        });

        callback(newBlob);
    };
    fileReader.readAsArrayBuffer(inputBlob);
}




function captureDesktop() {
    if (isRecording) {
        stopScreenRecording();
        return;
    }

    if (recorder && recorder.streams) {
        recorder.streams.forEach(function(stream, idx) {
            stream.getTracks().forEach(function(track) {
                track.stop();
            });

            if (idx == 0 && typeof stream.onended === 'function') {
                stream.onended();
            }
        });
        recorder.streams = null;
        return;
    }

    chrome.browserAction.setIcon({
        path: 'images/main-icon.png'
    });

    if (enableTabCaptureAPI) {
        captureTabUsingTabCapture();
        return;
    }

    var screenSources = ['screen', 'window', 'audio'];

    if (enableSpeakers === false) {
        screenSources = ['screen', 'window'];
    }

    // chrome.desktopCapture.chooseDesktopMedia(screenSources, onAccessApproved);
}

function onAccessApproved(chromeMediaSourceId, opts) {
    if (!chromeMediaSourceId || !chromeMediaSourceId.toString().length) {
        setDefaults();
        chrome.runtime.reload();
        return;
    }

    var constraints = {
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: chromeMediaSourceId
            },
            optional: []
        }
    };

    if (videoMaxFrameRates && videoMaxFrameRates.toString().length) {
        videoMaxFrameRates = parseInt(videoMaxFrameRates);

        // 30 fps seems max-limit in Chrome?
        if (videoMaxFrameRates /* && videoMaxFrameRates <= 30 */ ) {
            constraints.video.maxFrameRate = videoMaxFrameRates;
        }
    }

    constraints.video.mandatory.maxWidth = 3840;
    constraints.video.mandatory.maxHeight = 2160;

    constraints.video.mandatory.minWidth = 3840;
    constraints.video.mandatory.minHeight = 2160;

    if (opts.canRequestAudioTrack === true) {
        constraints.audio = {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: chromeMediaSourceId,
                echoCancellation: true
            },
            optional: []
        };
    }

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        if(enableSpeakers && !enableScreen) {
            var screenOnly = new MediaStream();
            getTracks(stream, 'video').forEach(function(track) {
                screenOnly.addTrack(track);

                // remove video track, because we are gonna record only speakers
                stream.removeTrack(track);
            });

            initVideoPlayer(screenOnly);
            addStreamStopListener(screenOnly, function() {
                stopScreenRecording();
            });

            // alert('You can stop recording only using extension icon. Whenever you are done, click extension icon to stop the recording.');
        }
        else {
            addStreamStopListener(stream, function() {
                stopScreenRecording();
            });
        }

        initVideoPlayer(stream);
        gotStream(stream);
    }).catch(function(error) {
        alert('Unable to capture screen using:\n' + JSON.stringify(constraints, null, '\t') + '\n\n' + error);
        setDefaults();
        chrome.runtime.reload();
    });
}




var microphoneDevice = false;
var cameraDevice = false;

function captureCamera(callback, defaultDevices) {
    var supported = navigator.mediaDevices.getSupportedConstraints();
    var constraints = {
        audio: !!enableMicrophone,
        video: !!enableCamera
    };

    if (enableCamera && !defaultDevices) {
        if(videoResolutions !== 'default' && videoResolutions.length) {
            var width = videoResolutions.split('x')[0];
            var height = videoResolutions.split('x')[1];

            if(width && height) {
                constraints.video = {
                    width: {
                        ideal: width
                    },
                    height: {
                        ideal: height
                    }
                };
            };
        }

        if (supported.aspectRatio) {
            constraints.video.aspectRatio = 1.777777778;
        }

        if (supported.frameRate && videoMaxFrameRates) {
            constraints.video.frameRate = {
                ideal: parseInt(videoMaxFrameRates)
            };
        }

        if (cameraDevice && typeof cameraDevice === 'string') {
            constraints.video.deviceId = cameraDevice;
        }
    }

    if (enableMicrophone && !defaultDevices) {
        constraints.audio = {};

        if (microphoneDevice && typeof microphoneDevice === 'string') {
            constraints.audio.deviceId = microphoneDevice;
        }

        if (supported.echoCancellation) {
            constraints.audio.echoCancellation = true;
        }
    }

    if(!constraints.audio && !constraints.video) {
        // todo: should we display alert?
        constraints = {
            audio: true,
            video: true
        };
    }

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        initVideoPlayer(stream);
        callback(stream);

        if (enableCamera && !enableScreen && openCameraPreviewDuringRecording) {
            var win = window.open("video.html", "_blank", "top=0,left=0,width=" + screen.width + ",height=" + screen.height);

            var timer = setInterval(function() {
                if (win.closed) {
                    clearInterval(timer);
                    stopScreenRecording();
                }
            }, 1000);
        }
    }).catch(function(error) {
        if(!defaultDevices) {
            // retry with default devices
            captureCamera(callback, true);
            return;
        }

        // false && chrome.tabs.create({
        //     url: 'camera-mic.html'
        // });

        var popup_width = screen.width - parseInt(screen.width / 3);
        var popup_height = screen.height - parseInt(screen.height / 3);
        chrome.windows.create({
            url: 'camera-mic.html',
            type: 'popup',
            width: popup_width,
            height: popup_height,
            top: parseInt((screen.height / 2) - (popup_height / 2)),
            left: parseInt((screen.width / 2) - (popup_width / 2)),
            focused: true
        });

        // setDefaults();
    });
}


function captureTabUsingTabCapture(isNoAudio) {
    // chrome.tabs.query({
    //     active: true,
    //     currentWindow: true
    // }, function (arrayOfTabs) {
        // var activeTab = arrayOfTabs[0];
        chrome.storage.sync.get('activeTabId', function (obj) {
            // var activeTabId = activeTab ? activeTab.id : savedId; // or do whatever you need
             // or do whatever you need
            
            var constraints = {
                audio: isNoAudio === true ? false : true,
                video: true,
                videoConstraints: {
                    mandatory: {
                        chromeMediaSource: 'tab',
                        maxWidth: 3840,
                        maxHeight: 2160
                    }
                },
                audioConstraints: isNoAudio === true ? false : {
                    mandatory: {
                        echoCancellation: true
                    }
                }
            };

            // chrome.tabCapture.onStatusChanged.addListener(function(event) { /* event.status */ });

            chrome.tabCapture.capture(constraints, function (stream) {
                gotTabCaptureStream(stream, constraints);
                // chrome.tabs.update(activeTabId, {active: true});
            });
        });

    // });
}

function gotTabCaptureStream(stream, constraints) {
    if (!stream) {
        if (constraints.audio === true) {
            captureTabUsingTabCapture(true);
            return;
        }
        chrome.runtime.reload();
        return;
    }

    var newStream = new MediaStream();

    if (enableTabCaptureAPIAudioOnly) {
        getTracks(stream, 'audio').forEach(function (track) {
            newStream.addTrack(track);
        });
    }
    else {
        stream.getTracks().forEach(function (track) {
            newStream.addTrack(track);
        });
    }

    initVideoPlayer(newStream);

    gotStream(newStream);
}




chrome.storage.sync.set({
    isRecording: 'false' // FALSE
});

chrome.browserAction.setIcon({
    path: 'images/main-icon.png'
});

function gotStream(stream) {
    var options = {
        type: 'video',
        disableLogs: false
    };

    if (!videoCodec) {
        videoCodec = 'Default'; // prefer VP9 by default
    }

    if (videoCodec) {
        if (videoCodec === 'Default') {
            options.mimeType = 'video/webm\;codecs=vp9';
        }

        if (videoCodec === 'VP8') {
            options.mimeType = 'video/webm\;codecs=vp8';
        }

        if (videoCodec === 'VP9') {
            options.mimeType = 'video/webm\;codecs=vp9';
        }

        if (videoCodec === 'H264') {
            if (isMimeTypeSupported('video/webm\;codecs=h264')) {
                options.mimeType = 'video/webm\;codecs=h264';
            }
        }

        if (videoCodec === 'MKV') {
            if (isMimeTypeSupported('video/x-matroska;codecs=avc1')) {
                options.mimeType = 'video/x-matroska;codecs=avc1';
            }
        }

        if (enableTabCaptureAPIAudioOnly || (enableMicrophone && !enableCamera && !enableScreen) || (enableSpeakers && !enableScreen && !enableCamera)) {
            options.mimeType = 'audio/wav';
        }
    }

    if (bitsPerSecond) {
        bitsPerSecond = parseInt(bitsPerSecond);
        if (!bitsPerSecond || bitsPerSecond < 100) {
            bitsPerSecond = 8000000000; // 1 GB /second
        }
    }

    if (bitsPerSecond) {
        options.bitsPerSecond = bitsPerSecond;
    }

    if (cameraStream) {
        var ignoreSecondPart = false;

        if (enableSpeakers && enableMicrophone) {
            var mixAudioStream = getMixedAudioStream([cameraStream, stream]);
            if (mixAudioStream && getTracks(mixAudioStream, 'audio').length) {
                ignoreSecondPart = true;

                var mixedTrack = getTracks(mixAudioStream, 'audio')[0];
                stream.addTrack(mixedTrack);
                getTracks(stream, 'audio').forEach(function (track) {
                    if (track === mixedTrack) return;
                    stream.removeTrack(track);
                });
            }
        }

        if (!ignoreSecondPart) {
            getTracks(cameraStream, 'audio').forEach(function (track) {
                stream.addTrack(track);
                cameraStream.removeTrack(track);
            });
        }
    }

    // fix https://github.com/muaz-khan/RecordRTC/issues/281
    options.ignoreMutedMedia = false;

    if (options.mimeType === 'audio/wav') {
        options.numberOfAudioChannels = 2;
        recorder = new StereoAudioRecorder(stream, options);
        recorder.streams = [stream];
    }
    else if (enableScreen && cameraStream && getTracks(cameraStream, 'video').length) {
        // adjust video on top over screen

        // on faster systems (i.e. 4MB or higher RAM):
        // screen: 3840x2160 
        // camera: 1280x720
        stream.width = screen.width;
        stream.height = screen.height;
        stream.fullcanvas = true; // screen should be full-width (wider/full-screen)

        // camera positioning + width/height
        cameraStream.width = parseInt((20 / 100) * stream.width);
        cameraStream.height = parseInt((20 / 100) * stream.height);
        cameraStream.top = stream.height - cameraStream.height;
        cameraStream.left = stream.width - cameraStream.width;

        // frame-rates
        options.frameInterval = 1;

        recorder = new MultiStreamRecorder([cameraStream, stream], options);
        recorder.streams = [stream, cameraStream];
    } else {
        recorder = new MediaStreamRecorder(stream, options);
        recorder.streams = [stream];
    }

    recorder.record();

    isRecording = true;
    onRecording();

    addStreamStopListener(recorder.streams[0], function () {
        stopScreenRecording();
    });

    initialTime = Date.now()
    timer = setInterval(checkTime, 100);

    // tell website that recording is started
    startRecordingCallback();
}

function stopScreenRecording() {
    if (!recorder || !isRecording) return;

    if (timer) {
        clearTimeout(timer);
    }
    setBadgeText('');
    isRecording = false;

    chrome.browserAction.setTitle({
        title: 'Record Your Screen, Tab or Camera'
    });
    chrome.browserAction.setIcon({
        path: 'images/main-icon.png'
    });

    recorder.stop(function onStopRecording(blob, ignoreGetSeekableBlob) {
        if (fixVideoSeekingIssues && recorder && !ignoreGetSeekableBlob) {
            getSeekableBlob(recorder.blob, function (seekableBlob) {
                onStopRecording(seekableBlob, true);
            });
            return;
        }

        var mimeType = 'video/mp4';
        var fileExtension = 'mp4';

        if (videoCodec === 'H264') {
            if (isMimeTypeSupported('video/webm\;codecs=h264')) {
                mimeType = 'video/mp4';
                fileExtension = 'mp4';
            }
        }

        if (videoCodec === 'MKV') {
            if (isMimeTypeSupported('video/x-matroska;codecs=avc1')) {
                mimeType = 'video/mkv';
                fileExtension = 'mkv';
            }
        }

        if (enableTabCaptureAPIAudioOnly || (enableMicrophone && !enableCamera && !enableScreen) || (enableSpeakers && !enableScreen && !enableCamera)) {
            mimeType = 'audio/wav';
            fileExtension = 'wav';
        }


        var fileUrl = recorder ? URL.createObjectURL(recorder.blob) : '';

        var file = new File([recorder ? recorder.blob : ''], getFileName(fileExtension), {
            type: mimeType
        });

        if (ignoreGetSeekableBlob === true) {
            file = new File([blob], getFileName(fileExtension), {
                type: mimeType
            });
        }

        localStorage.setItem('selected-file', file.name);

        var saveLink = document.createElement("a");
        saveLink.setAttribute('href', fileUrl);

        chrome.storage.sync.get(['consecutive', 'name'], function (config) {
            saveLink.setAttribute('download', config.name + config.consecutive + '.mp4');
            saveLink.click();
            URL.revokeObjectURL(saveLink.href);
            setDefaults();
            chrome.storage.sync.set({ consecutive: parseInt(config.consecutive) + 1 })
        })
    });
}

function setDefaults() {
    chrome.browserAction.setIcon({
        path: 'images/main-icon.png'
    });

    if (recorder && recorder.streams) {
        recorder.streams.forEach(function (stream) {
            stream.getTracks().forEach(function (track) {
                track.stop();
            });
        });

        recorder.streams = null;
    }

    recorder = null;
    isRecording = false;
    imgIndex = 0;

    bitsPerSecond = 0;
    enableTabCaptureAPI = false;
    enableTabCaptureAPIAudioOnly = false;
    enableScreen = true;
    enableMicrophone = false;
    enableCamera = false;
    cameraStream = false;
    enableSpeakers = true;
    videoCodec = 'Default';
    videoMaxFrameRates = '';
    videoResolutions = '1920x1080';
    isRecordingVOD = false;
    fixVideoSeekingIssues = false;

    // for dropdown.js
    chrome.storage.sync.set({
        isRecording: 'false' // FALSE
    });
}

function getUserConfigs() {
    chrome.storage.sync.get(null, function (items) {
        if (items['bitsPerSecond'] && items['bitsPerSecond'].toString().length && items['bitsPerSecond'] !== 'default') {
            bitsPerSecond = parseInt(items['bitsPerSecond']);
        }

        if (items['enableTabCaptureAPI']) {
            enableTabCaptureAPI = items['enableTabCaptureAPI'] == 'true';
        }

        if (items['enableTabCaptureAPIAudioOnly']) {
            enableTabCaptureAPIAudioOnly = items['enableTabCaptureAPIAudioOnly'] == 'true';
        }

        if (items['enableCamera']) {
            enableCamera = items['enableCamera'] == 'true';
        }

        if (items['enableSpeakers']) {
            enableSpeakers = items['enableSpeakers'] == 'true';
        }

        if (items['enableScreen']) {
            enableScreen = items['enableScreen'] == 'true';
        }

        if (items['enableMicrophone']) {
            enableMicrophone = items['enableMicrophone'] == 'true';
        }

        if (enableMicrophone || enableCamera) {
            if (!enableScreen && !enableSpeakers) {
                captureCamera(function (stream) {
                    gotStream(stream);
                });
                return;
            }
            captureCamera(function (stream) {
                cameraStream = stream;
                captureDesktop();
            });
            return;
        }
        captureDesktop();
    });
}

// false && chrome.storage.sync.get('openPreviewPage', function (item) {
//     if (item.openPreviewPage !== 'true') return;

//     chrome.storage.sync.set({
//         isRecording: 'false',
//         openPreviewPage: 'false'
//     });

//     chrome.tabs.query({}, function (tabs) {
//         var found = false;
//         var url = 'chrome-extension://' + chrome.runtime.id + '/preview.html';
//         for (var i = tabs.length - 1; i >= 0; i--) {
//             if (tabs[i].url === url) {
//                 found = true;
//                 chrome.tabs.update(tabs[i].id, {
//                     active: true,
//                     url: url
//                 });
//                 break;
//             }
//         }
//         if (!found) {
//             chrome.tabs.create({
//                 url: 'preview.html'
//             });
//         }
//     });

//     // invokeSaveAsDialog(file, file.name);
// });



var runtimePort;
var recordProcessing;

// chrome.tabs.query({
//     active: true,
//     currentWindow: true
// }, function (arrayOfTabs) {
//     var activeTab = arrayOfTabs[0];
//     chrome.storage.sync.set({
//         activeTabId: activeTab.id
//     });
// });
chrome.runtime.onConnect.addListener(function (port) {
    runtimePort = port;

    runtimePort.onMessage.addListener(function (message) {

        if (!message || !message.messageFromContentScript1234) {
            return;
        }

        if (message.startRecording) {
            var firstTime = true;

            function startRecording() {
                setTimeout(function () {
                    stopScreenRecording();
                    return;
                }, message.time * 1000)

                getUserConfigs();
                return;
            }
            firstTime && startRecording();
            firstTime = false;
            recordProcessing = setInterval(function () {
                startRecording();
            }, (parseInt(message.time) + 3) * 1000)

        }

        if (message.stopRecording) {
            clearInterval(recordProcessing);
            stopScreenRecording();
            return;
        }
    });
});
