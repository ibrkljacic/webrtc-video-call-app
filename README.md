# WebRTC Video Call App

A modern, real-time video calling application built with WebRTC and Firebase. Create instant video calls with shareable links and join from any device.

## ✨ Features

- **One-click video calls** - Start your webcam and get a shareable link instantly
- **Cross-device compatibility** - Works on desktop, mobile, and tablets
- **Real-time status updates** - See when someone joins or leaves the call
- **Modern UI** - Clean, responsive design with smooth animations
- **No downloads required** - Works directly in the browser
- **Secure connections** - HTTPS required for camera access

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Firebase account
- Modern browser with camera support

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd webrtc_app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a new Firebase project
   - Enable Firestore Database
   - Update Firestore security rules to allow read/write
   - Copy your Firebase config to `.env` file

4. **Generate SSL certificates** (for HTTPS)
   ```bash
   npm run generate-certs
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `https://localhost:5173`
   - Allow camera access when prompted

## 📱 How to Use

### Creating a Call
1. Click **"Start webcam"** to enable your camera
2. A shareable link will automatically appear
3. Click **"Copy"** to copy the link
4. Share the link with someone to invite them

### Joining a Call
1. Click the shared link
2. Click **"Start webcam"** to join the call
3. You'll automatically connect to the other participant

### During the Call
- **Stop webcam** - Ends your participation in the call
- **Real-time status** - See when others join or leave
- **Automatic cleanup** - Call ends when all participants leave

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time Communication**: WebRTC (RTCPeerConnection)
- **Signaling Server**: Firebase Firestore
- **Development Server**: Vite
- **Styling**: Modern CSS with Grid/Flexbox

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Update security rules:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // For development
       }
     }
   }
   ```
4. Create `.env` file with your Firebase config:
   ```bash
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
   ```

### HTTPS Setup
The app requires HTTPS for camera access. SSL certificates are automatically generated for localhost.

## 📁 Project Structure

```
webrtc_app/
├── index.html              # Main HTML file
├── src/
│   ├── main.js            # WebRTC logic and Firebase integration
│   └── style.css          # Modern styling
├── certs/                 # SSL certificates (auto-generated)
├── .env                   # Environment variables (not in git)
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
└── README.md              # This file
```

## 🌐 Browser Support

- **Chrome** (recommended)
- **Firefox**
- **Safari** (iOS 14+)
- **Edge**

## 🔒 Security Notes

- HTTPS is required for camera access
- Self-signed certificates are used for local development
- For production, use proper SSL certificates
- Firestore security rules should be tightened for production
- `.env` file should never be committed to git

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Deploy to Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Deploy: `firebase deploy`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Camera Access Issues
- Ensure you're using HTTPS
- Check browser permissions
- Try refreshing the page

### Connection Problems
- Check your internet connection
- Ensure Firebase is properly configured
- Try using a different browser

### Development Issues
- Clear browser cache
- Restart the development server
- Check console for error messages

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Built with ❤️ using WebRTC and Firebase** 