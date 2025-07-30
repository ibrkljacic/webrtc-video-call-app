import './style.css';



import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, updateDoc, getDoc, onSnapshot, addDoc, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// Test Firebase connection
console.log('Firebase initialized with project:', firebaseConfig.projectId);
console.log('Firebase config:', firebaseConfig);
console.log('Using Firestore cloud database');

// Test Firestore connection
const testCollection = collection(firestore, 'test');
console.log('Firestore collection reference created:', testCollection);

// Test write permission
const testDoc = doc(testCollection, 'test-doc');
setDoc(testDoc, { test: 'data', timestamp: new Date() })
  .then(() => {
    console.log('✅ Firestore write test successful');
  })
  .catch((error) => {
    console.error('❌ Firestore write test failed:', error);
  });

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
  // Optimize for video performance
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  // Reduce connection establishment time
  iceConnectionChecking: true,
};

// Global State
let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let currentCallId = null;
let firestoreListeners = [];
let isInCall = false;
let isEndingCall = false;
let hasShownUserLeftOverlay = false;

// Function to create a new peer connection
function createNewPeerConnection() {
  pc = new RTCPeerConnection(servers);
  console.log('New RTCPeerConnection created');

  // Monitor connection state changes
  pc.onconnectionstatechange = () => {
    console.log('Connection state changed:', pc.connectionState);

    if (pc.connectionState === 'failed') {
      console.log('Connection failed - ending call');
      handleCallEnded('connection_failed');
    } else if (pc.connectionState === 'disconnected') {
      console.log('Connection disconnected - checking if other user left');
      // Check Firestore to see if call was ended by other user
      if (currentCallId) {
        const callDoc = doc(firestore, 'calls', currentCallId);
        getDoc(callDoc).then((snapshot) => {
          const data = snapshot.data();
          if (data && data.ended && data.endedBy === 'user_hangup' && !data.endedByCurrentUser) {
            console.log('Other user left - clearing stream');
            if (remoteVideo && remoteVideo.srcObject) {
              remoteVideo.srcObject = null;
              remoteVideo.style.opacity = '0.5';
              remoteStream = null;
            }
          }
        }).catch((error) => {
          console.error('Error checking call status:', error);
        });
      }
    } else if (pc.connectionState === 'closed') {
      console.log('Connection closed - checking if other user left');
      // Check Firestore to see if call was ended by other user
      if (currentCallId) {
        const callDoc = doc(firestore, 'calls', currentCallId);
        getDoc(callDoc).then((snapshot) => {
          const data = snapshot.data();
          if (data && data.ended && data.endedBy === 'user_hangup' && !data.endedByCurrentUser) {
            console.log('Other user left - clearing stream');
            if (remoteVideo && remoteVideo.srcObject) {
              remoteVideo.srcObject = null;
              remoteVideo.style.opacity = '0.5';
              remoteStream = null;
            }
          }
        }).catch((error) => {
          console.error('Error checking call status:', error);
        });
      }
    }
  };

    // Monitor ICE connection state
  pc.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', pc.iceConnectionState);

    if (pc.iceConnectionState === 'failed') {
      console.log('ICE connection failed - ending call');
      handleCallEnded('ice_connection_failed');
    } else if (pc.iceConnectionState === 'disconnected') {
      console.log('ICE disconnected - checking if other user left');
      // Check Firestore to see if call was ended by other user
      if (currentCallId) {
        const callDoc = doc(firestore, 'calls', currentCallId);
        getDoc(callDoc).then((snapshot) => {
          const data = snapshot.data();
          if (data && data.ended && data.endedBy === 'user_hangup' && !data.endedByCurrentUser) {
            console.log('Other user left - clearing stream');
            if (remoteVideo && remoteVideo.srcObject) {
              remoteVideo.srcObject = null;
              remoteVideo.style.opacity = '0.5';
              remoteStream = null;
            }
          }
        }).catch((error) => {
          console.error('Error checking call status:', error);
        });
      }
    }
  };

  return pc;
}

// Periodic health check to detect when other user has left
let healthCheckInterval;

function startHealthCheck() {
  healthCheckInterval = setInterval(() => {
    if (isInCall && pc && currentCallId) {
      // Check if connection is in a bad state
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' ||
          pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
        console.log('Health check detected connection issues');

        // Check Firestore to see if the call was actually ended by someone
        const callDoc = doc(firestore, 'calls', currentCallId);
        getDoc(callDoc).then((snapshot) => {
          const data = snapshot.data();
          if (data && data.ended && data.endedBy === 'user_hangup' && !data.endedByCurrentUser) {
            console.log('Call was ended by other user - clearing stream');

            // Only clear remote stream if it exists and is frozen
            if (remoteVideo && remoteVideo.srcObject && remoteStream) {
              console.log('Clearing frozen remote stream');
              remoteVideo.srcObject = null;
              remoteVideo.style.opacity = '0.5';
              remoteStream = null;

              // Update notification only if it's visible
              if (joinNotification.style.display !== 'none') {
                joinNotification.innerHTML = '<p>👋 Other user left the call. You can stop your webcam or wait for someone else to join.</p>';
              }
            }
          } else if (data && data.ended) {
            console.log('Call was ended - user should leave');
            // Call was ended, user should leave
            handleCallEnded('call_ended_by_other');
          }
        }).catch((error) => {
          console.error('Error checking call status in health check:', error);
        });
      }
    }
  }, 10000); // Check every 10 seconds
}

function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// Function to handle call ending
function handleCallEnded(reason) {
  if (!isInCall) return;

  console.log('Call ended:', reason);

      // Only automatically end the call for connection failures or when call is ended by other
  if (reason === 'connection_failed' || reason === 'ice_connection_failed' || reason === 'connection_health_check_failed' || reason === 'call_ended_by_other') {
    isInCall = false;

    // Reset UI state
    copyLinkButton.disabled = true;
    stopWebcamButton.disabled = true;
    webcamButton.disabled = false;

    // Clear video sources
    if (webcamVideo) webcamVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    // Clear input
    callInput.value = '';

    // Cleanup resources
    cleanupResources();
  }
}

// Function to cleanup resources
async function cleanupResources() {
  try {
    // Close peer connection
    if (pc && pc.signalingState !== 'closed') {
      pc.close();
    }

    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // Clear video sources
    if (webcamVideo) webcamVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    // Remove current call from Firestore if exists
    if (currentCallId) {
      try {
        const callDoc = doc(firestore, 'calls', currentCallId);
        await updateDoc(callDoc, {
          ended: true,
          endedAt: new Date(),
          endedBy: 'browser_close'
        });
        console.log('Call marked as ended in Firestore');
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }

    // Unsubscribe from all Firestore listeners
    firestoreListeners.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    firestoreListeners = [];

    console.log('Resources cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Cleanup when page is unloaded
window.addEventListener('beforeunload', cleanupResources);
window.addEventListener('unload', cleanupResources);

// Periodic connection health check (disabled to prevent false session endings)
// setInterval(() => {
//   if (isInCall && pc && pc.connectionState === 'failed') {
//     console.log('Connection health check failed');
//     handleCallEnded('connection_health_check_failed');
//   }
// }, 15000);

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const stopWebcamButton = document.getElementById('stopWebcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const linkDisplay = document.getElementById('linkDisplay');
const generatedLink = document.getElementById('generatedLink');
const copyLinkButton = document.getElementById('copyLinkButton');
const joinNotification = document.getElementById('joinNotification');
const remoteVideo = document.getElementById('remoteVideo');

// Add click event listener to webcam button for debugging
webcamButton.addEventListener('click', () => {
  console.log('Webcam button clicked - disabled state:', webcamButton.disabled);
});

// 1. Setup media sources
webcamButton.onclick = async () => {
  try {


        // Let browser handle getUserMedia natively - no fallbacks

    // Always create a new RTCPeerConnection for fresh start
    console.log('Creating new RTCPeerConnection for webcam start...');
    createNewPeerConnection();

    // Use more compatible constraints for mobile devices
    const constraints = {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

        console.log('Requesting media with constraints:', constraints);

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    remoteStream = new MediaStream();

    // Set up track event handler
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    // Push tracks from local stream to peer connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    copyLinkButton.disabled = false;
    stopWebcamButton.disabled = false;
    webcamButton.disabled = true;

    // Only generate and show shareable link if user is not joining an existing call
    if (!window.pendingCallId) {
      linkDisplay.style.display = 'flex';
      // Automatically generate a shareable link
      await generateShareableLink();
    }

    console.log('Webcam started successfully');
      } catch (error) {
    console.error('Error starting webcam:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Show original error message for debugging
    alert('Error starting webcam: ' + error.message);
  }
};

// 2. Generate shareable link function
async function generateShareableLink() {
  try {
    console.log('Generating shareable link...');
    console.log('Firestore instance:', firestore);

    // Reference Firestore collections for signaling
    const callsCollection = collection(firestore, 'calls');
    console.log('Calls collection:', callsCollection);

    const callDocRef = doc(callsCollection);
    console.log('Call document reference:', callDocRef);

    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    currentCallId = callDocRef.id;
    console.log('Call ID:', callDocRef.id);

    // Get candidates for caller, save to db
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await addDoc(offerCandidates, event.candidate.toJSON());
          console.log('ICE candidate added');
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    console.log('Setting document with offer...');
    await setDoc(callDocRef, { offer });
    console.log('Document set successfully');

    // Listen for remote answer and call status changes
    const answerListener = onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }

      // Check if call was ended by the other user (only if we're in an active call and call was recently ended)
      if (isInCall && data?.ended && data?.endedBy === 'user_hangup' && data?.endedAt) {
        const endedTime = data.endedAt.toDate ? data.endedAt.toDate() : new Date(data.endedAt);
        const now = new Date();
        const timeDiff = now - endedTime;

        // Only show overlay if the call was ended within the last 2 seconds and we're not the one who ended it
        if (timeDiff < 2000 && !isEndingCall && !data?.endedByCurrentUser && isInCall && !hasShownUserLeftOverlay) {
          console.log('Other user left the call - clearing remote stream and showing overlay');
          hasShownUserLeftOverlay = true; // Prevent multiple triggers

          // Clear the remote stream to remove frozen video
          if (remoteVideo) {
            remoteVideo.srcObject = null;
            remoteVideo.style.opacity = '0.5';
            // Add a message overlay
            const overlay = document.createElement('div');
            overlay.id = 'user-left-overlay';
            overlay.style.cssText = `
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(0,0,0,0.7);
              color: white;
              padding: 10px 20px;
              border-radius: 5px;
              z-index: 1000;
            `;
            overlay.textContent = 'Other user left the call';
            remoteVideo.parentElement.style.position = 'relative';
            remoteVideo.parentElement.appendChild(overlay);
          }

          // Also clear the remote stream object
          remoteStream = null;

          // Update notification to show other user left
          if (joinNotification.style.display !== 'none') {
            joinNotification.innerHTML = '<p>👋 Other user left the call. You can stop your webcam or wait for someone else to join.</p>';
          }

          // Reset the peer connection to clean state
          if (pc && pc.connectionState !== 'closed') {
            console.log('Resetting peer connection after other user left');
            pc.close();
            createNewPeerConnection();
          }

          // Keep the call active - user can still hang up manually
          // Don't change any UI state except showing the overlay
          // Don't call handleCallEnded - this keeps the session alive
        }
      }
    });
    firestoreListeners.push(answerListener);

    // When answered, add candidate to peer connection
    const candidateListener = onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
    firestoreListeners.push(candidateListener);

    isInCall = true;
    hasShownUserLeftOverlay = false;

    // Start health check for the call
    startHealthCheck();

    // Create shareable link
    const callLink = `${window.location.origin}${window.location.pathname}?call=${callDocRef.id}`;

    // Show the link in the UI
    generatedLink.value = callLink;

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(callLink);
    } catch (err) {
      console.log('Clipboard API not available');
    }
  } catch (error) {
    console.error('Error generating shareable link:', error);
  }
}



// 4. Stop webcam functionality
stopWebcamButton.onclick = async () => {
  try {
    // Immediately reset UI for instant feedback
    stopWebcamButton.disabled = true;
    webcamButton.disabled = false;

    console.log('Stopping webcam...');

    // Clear video sources immediately
    webcamVideo.srcObject = null;
    remoteVideo.srcObject = null;

        // Clear and disable link
    generatedLink.value = '';
    copyLinkButton.disabled = true;

    // Update notification to show user has left
    if (isInCall) {
      joinNotification.innerHTML = '<p>👋 You have left the call.</p>';
    }

    // Clean up call status listener if exists
    if (window.callStatusListener) {
      window.callStatusListener();
      delete window.callStatusListener;
    }

    // Stop all tracks
    if (localStream) {
      console.log('Stopping local stream tracks');
      localStream.getTracks().forEach(track => track.stop());
    }

    // Reset streams
    localStream = null;
    remoteStream = null;

    // Close peer connection
    if (pc && pc.connectionState !== 'closed') {
      console.log('Closing peer connection');
      pc.close();
    }

    // Create new peer connection for clean state
    createNewPeerConnection();

    // Mark call as ended in Firestore if we were in a call
    if (currentCallId && isInCall) {
      try {
        isEndingCall = true;
        const callDoc = doc(firestore, 'calls', currentCallId);
        await updateDoc(callDoc, {
          ended: true,
          endedAt: new Date(),
          endedBy: 'user_hangup',
          endedByCurrentUser: true
        });
        console.log('Call marked as ended in Firestore');
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }

    // Stop health check
    stopHealthCheck();

    // Clear current call ID and reset state
    currentCallId = null;
    isInCall = false;
    isEndingCall = false;
    hasShownUserLeftOverlay = false;

    // Unsubscribe from all Firestore listeners
    firestoreListeners.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    firestoreListeners = [];

    console.log('Webcam stopped - ready for new session');
  } catch (error) {
    console.error('Error stopping webcam:', error);
  }
};

// Copy link button functionality
copyLinkButton.onclick = async () => {
  try {
    await navigator.clipboard.writeText(generatedLink.value);
    const originalText = copyLinkButton.textContent;
    copyLinkButton.textContent = 'Copied!';
    setTimeout(() => {
      copyLinkButton.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Error copying link:', err);
    // Fallback: select the input text
    generatedLink.select();
    generatedLink.setSelectionRange(0, 99999);
  }
};

// Helper function to join a call programmatically
async function joinCallById(callId) {
  try {
    console.log('Joining call by ID:', callId);

    // Check if this is the same call we created (prevent self-answering)
    if (currentCallId === callId) {
      alert('You cannot join your own call. Please use a different device or browser.');
      return;
    }

    currentCallId = callId;
    const callDoc = doc(firestore, 'calls', callId);
    const answerCandidates = collection(callDoc, 'answerCandidates');
    const offerCandidates = collection(callDoc, 'offerCandidates');

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await addDoc(answerCandidates, event.candidate.toJSON());
          console.log('Answer ICE candidate added');
        } catch (error) {
          console.error('Error adding answer ICE candidate:', error);
        }
      }
    };

    console.log('Getting call data...');
    const callData = (await getDoc(callDoc)).data();
    console.log('Call data:', callData);

    if (!callData || !callData.offer) {
      alert('Call not found or no offer available');
      return;
    }

    // Check if call was already ended
    if (callData.ended) {
      alert('This call has already ended');
      return;
    }

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    console.log('Updating document with answer...');
    await updateDoc(callDoc, { answer });
    console.log('Answer sent successfully');

    const offerListener = onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        console.log(change);
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    firestoreListeners.push(offerListener);

    isInCall = true;
    hasShownUserLeftOverlay = false;

    // Start health check for the call
    startHealthCheck();

    // Show success message
    joinNotification.innerHTML = '<p>✅ Successfully joined the call!</p>';
  } catch (error) {
    console.error('Error joining call:', error);
    joinNotification.innerHTML = '<p>❌ Failed to join the call.</p>';
    alert('Error joining call: ' + error.message);
  }
}

// Store the original webcam onclick function
let originalWebcamOnclick;

// Check for call ID in URL parameters on page load
window.addEventListener('load', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const callId = urlParams.get('call');

  if (callId) {
    console.log('Found call ID in URL:', callId);

    // Check if someone is already in the call
    try {
      const callDoc = doc(firestore, 'calls', callId);
      const callData = (await getDoc(callDoc)).data();

      if (callData && callData.answer) {
        // Someone is already in the call
        joinNotification.innerHTML = '<p>📞 Someone is waiting in the call! Start your webcam to join.</p>';
      } else if (callData && callData.offer) {
        // Call exists but no one has joined yet
        joinNotification.innerHTML = '<p>📞 Call is ready! Start your webcam to join.</p>';
      } else {
        // Call doesn't exist or is invalid
        joinNotification.innerHTML = '<p>⚠️ Call not found or has ended.</p>';
        return;
      }

      joinNotification.style.display = 'block';
      // Hide the share link section since this user is joining, not hosting
      linkDisplay.style.display = 'none';
      // Store the call ID to join after webcam starts
      window.pendingCallId = callId;

      // Set up real-time listener to show when someone joins/leaves
      const callStatusListener = onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (data) {
          if (data.ended) {
            joinNotification.innerHTML = '<p>⚠️ Call has ended.</p>';
          } else if (data.answer) {
            joinNotification.innerHTML = '<p>📞 Someone is waiting in the call! Start your webcam to join.</p>';
          } else if (data.offer) {
            joinNotification.innerHTML = '<p>📞 Call is ready! Start your webcam to join.</p>';
          }
        }
      });

      // Store the listener to clean up later
      window.callStatusListener = callStatusListener;
    } catch (error) {
      console.error('Error checking call status:', error);
      joinNotification.innerHTML = '<p>⚠️ Error checking call status.</p>';
      joinNotification.style.display = 'block';
    }
  }
});

// Modify webcam button to check for pending call after it's defined
setTimeout(() => {
  originalWebcamOnclick = webcamButton.onclick;
  webcamButton.onclick = async () => {
    await originalWebcamOnclick();

            // Check if there's a pending call to join
    if (window.pendingCallId) {
      const callId = window.pendingCallId;
      delete window.pendingCallId;

      // Update the notification to show user is joining
      joinNotification.innerHTML = '<p>🔄 Joining the call...</p>';

      // Clean up the call status listener
      if (window.callStatusListener) {
        window.callStatusListener();
        delete window.callStatusListener;
      }

      // Small delay to ensure webcam is fully started
      setTimeout(() => {
        joinCallById(callId);
      }, 1000);
    }
  };
}, 100);