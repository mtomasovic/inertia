function App() {
    const { Container } = ReactBootstrap;
    
    // Base game box dimensions and aspect ratio
    const BASE_WIDTH = 600;
    const BASE_HEIGHT = 400;
    const ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT; // 1.5:1 ratio
    const BALL_SIZE = 20;
    const BORDER_WIDTH = 3;
    const ACCELERATION = 0.5; // How fast velocity increases when key is held
    const FRICTION = 0.95; // Friction coefficient (0.95 = 5% speed reduction per frame)
    const MIN_VELOCITY = 0.1; // Minimum velocity before stopping completely
    
    // State for responsive dimensions
    const [dimensions, setDimensions] = React.useState({
        width: BASE_WIDTH,
        height: BASE_HEIGHT
    });
    
    // Calculate responsive dimensions
    React.useEffect(() => {
        const calculateDimensions = () => {
            const padding = 40; // Padding around the game box
            const maxViewportWidth = window.innerWidth - padding;
            const maxViewportHeight = window.innerHeight - padding - 200; // Extra space for title and instructions
            
            // Calculate maximum possible dimensions while maintaining aspect ratio
            let newWidth = maxViewportWidth;
            let newHeight = newWidth / ASPECT_RATIO;
            
            // If height exceeds viewport, constrain by height instead
            if (newHeight > maxViewportHeight) {
                newHeight = maxViewportHeight;
                newWidth = newHeight * ASPECT_RATIO;
            }
            
            // Ensure minimum size for playability
            const minWidth = 300;
            const minHeight = minWidth / ASPECT_RATIO;
            
            newWidth = Math.max(minWidth, Math.min(newWidth, BASE_WIDTH * 1.5)); // Max 1.5x the base size
            newHeight = Math.max(minHeight, Math.min(newHeight, BASE_HEIGHT * 1.5));
            
            setDimensions({
                width: Math.round(newWidth),
                height: Math.round(newHeight)
            });
        };
        
        calculateDimensions();
        window.addEventListener('resize', calculateDimensions);
        window.addEventListener('orientationchange', () => {
            // Re-center ball on orientation change
            setTimeout(() => {
                calculateDimensions();
                // Reset ball position to center after orientation change
                setBallPosition({
                    x: (PLAYABLE_WIDTH - BALL_SIZE) / 2,
                    y: (PLAYABLE_HEIGHT - BALL_SIZE) / 2
                });
                // Also reset velocity to prevent weird movement
                setVelocity({ x: 0, y: 0 });
            }, 100); // Small delay to ensure dimensions are updated
        });
        
        return () => {
            window.removeEventListener('resize', calculateDimensions);
            window.removeEventListener('orientationchange', calculateDimensions);
        };
    }, []);
    
    // Effective playable area (accounting for borders)
    const PLAYABLE_WIDTH = dimensions.width - (BORDER_WIDTH * 2);
    const PLAYABLE_HEIGHT = dimensions.height - (BORDER_WIDTH * 2);
    
    // Ball position and velocity state
    const [ballPosition, setBallPosition] = React.useState({
        x: (PLAYABLE_WIDTH - BALL_SIZE) / 2, // Center horizontally
        y: (PLAYABLE_HEIGHT - BALL_SIZE) / 2  // Center vertically
    });
    
    // Re-center ball when dimensions change
    React.useEffect(() => {
        setBallPosition({
            x: (PLAYABLE_WIDTH - BALL_SIZE) / 2,
            y: (PLAYABLE_HEIGHT - BALL_SIZE) / 2
        });
    }, [PLAYABLE_WIDTH, PLAYABLE_HEIGHT]);
    
    const [velocity, setVelocity] = React.useState({ x: 0, y: 0 });
    const [keysPressed, setKeysPressed] = React.useState(new Set());
    const [tiltSupported, setTiltSupported] = React.useState(false);
    const [tilt, setTilt] = React.useState({ x: 0, y: 0 });

    React.useEffect(() => {
        document.title = "Inertia";
    }, []);

    // Handle device orientation for mobile tilt controls
    React.useEffect(() => {
        const handleDeviceOrientation = (event) => {
            // DeviceOrientationEvent provides:
            // beta: front-back tilt in degrees (-180 to 180)
            // gamma: left-right tilt in degrees (-90 to 90)
            
            if (event.beta !== null && event.gamma !== null) {
                const maxTilt = 30; // Maximum tilt angle to consider
                const sensitivity = 1.2; // Increased sensitivity
                
                // Convert tilt to acceleration values
                // gamma: negative = tilt left, positive = tilt right
                // beta: negative = tilt away, positive = tilt toward
                let tiltX = Math.max(-1, Math.min(1, event.gamma / maxTilt)) * sensitivity;
                let tiltY = Math.max(-1, Math.min(1, event.beta / maxTilt)) * sensitivity;
                
                // Adjust for device orientation (landscape vs portrait)
                if (window.orientation === 90 || window.orientation === -90) {
                    // Landscape mode - swap and adjust axes
                    const temp = tiltX;
                    tiltX = window.orientation === 90 ? tiltY : -tiltY;
                    tiltY = window.orientation === 90 ? -temp : temp;
                }
                
                setTilt({ x: tiltX, y: tiltY });
                
                // Set tilt supported if we're getting valid data
                if (!tiltSupported) {
                    setTiltSupported(true);
                }
            }
        };

        const handleDeviceMotion = (event) => {
            // Fallback to DeviceMotionEvent if orientation doesn't work
            if (event.accelerationIncludingGravity) {
                const { x, y } = event.accelerationIncludingGravity;
                if (x !== null && y !== null) {
                    const maxAccel = 5; // Maximum acceleration to consider
                    const sensitivity = 0.3;
                    
                    let tiltX = Math.max(-1, Math.min(1, x / maxAccel)) * sensitivity;
                    let tiltY = Math.max(-1, Math.min(1, -y / maxAccel)) * sensitivity; // Invert Y
                    
                    // Adjust for device orientation
                    if (window.orientation === 90 || window.orientation === -90) {
                        const temp = tiltX;
                        tiltX = window.orientation === 90 ? -tiltY : tiltY;
                        tiltY = window.orientation === 90 ? temp : -temp;
                    }
                    
                    setTilt({ x: tiltX, y: tiltY });
                    
                    if (!tiltSupported) {
                        setTiltSupported(true);
                    }
                }
            }
        };

        const requestPermission = async () => {
            let permissionGranted = false;
            
            // Check if DeviceOrientationEvent is supported
            if (typeof DeviceOrientationEvent !== 'undefined') {
                // For iOS 13+ devices, need to request permission
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    // Don't auto-request permission, wait for user interaction
                    return;
                } else {
                    // For other devices, just add the event listener
                    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
                    permissionGranted = true;
                }
            }
            
            // Also try DeviceMotionEvent as fallback
            if (typeof DeviceMotionEvent !== 'undefined') {
                if (typeof DeviceMotionEvent.requestPermission === 'function') {
                    // Don't auto-request permission for motion either
                } else {
                    window.addEventListener('devicemotion', handleDeviceMotion, true);
                    permissionGranted = true;
                }
            }
            
            // Set a timeout to check if we got any motion data
            if (permissionGranted) {
                setTimeout(() => {
                    // This will be set by the event handlers if they receive data
                }, 2000);
            }
        };

        requestPermission();

        return () => {
            window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
            window.removeEventListener('devicemotion', handleDeviceMotion, true);
        };
    }, [tiltSupported]);

    // Add click handler for iOS permission request
    const requestTiltPermission = async () => {
        let hasPermission = false;
        
        // Try DeviceOrientationEvent first
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', (event) => {
                        if (event.beta !== null && event.gamma !== null) {
                            const maxTilt = 30;
                            const sensitivity = 1.2;
                            let tiltX = Math.max(-1, Math.min(1, event.gamma / maxTilt)) * sensitivity;
                            let tiltY = Math.max(-1, Math.min(1, event.beta / maxTilt)) * sensitivity;
                            
                            if (window.orientation === 90 || window.orientation === -90) {
                                const temp = tiltX;
                                tiltX = window.orientation === 90 ? tiltY : -tiltY;
                                tiltY = window.orientation === 90 ? -temp : temp;
                            }
                            
                            setTilt({ x: tiltX, y: tiltY });
                            setTiltSupported(true);
                        }
                    }, true);
                    hasPermission = true;
                }
            } catch (error) {
                console.log('DeviceOrientation permission denied:', error);
            }
        }
        
        // Try DeviceMotionEvent as fallback
        if (!hasPermission && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const response = await DeviceMotionEvent.requestPermission();
                if (response === 'granted') {
                    window.addEventListener('devicemotion', (event) => {
                        if (event.accelerationIncludingGravity) {
                            const { x, y } = event.accelerationIncludingGravity;
                            if (x !== null && y !== null) {
                                const maxAccel = 5;
                                const sensitivity = 0.3;
                                let tiltX = Math.max(-1, Math.min(1, x / maxAccel)) * sensitivity;
                                let tiltY = Math.max(-1, Math.min(1, -y / maxAccel)) * sensitivity;
                                
                                if (window.orientation === 90 || window.orientation === -90) {
                                    const temp = tiltX;
                                    tiltX = window.orientation === 90 ? -tiltY : tiltY;
                                    tiltY = window.orientation === 90 ? temp : -temp;
                                }
                                
                                setTilt({ x: tiltX, y: tiltY });
                                setTiltSupported(true);
                            }
                        }
                    }, true);
                    hasPermission = true;
                }
            } catch (error) {
                console.log('DeviceMotion permission denied:', error);
            }
        }
        
        if (!hasPermission) {
            alert('Tilt controls require device orientation/motion permissions. Please check your browser settings.');
        }
    };

    // Handle key press and release
    React.useEffect(() => {
        const handleKeyDown = (event) => {
            const key = event.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                setKeysPressed(prev => new Set([...prev, key]));
            }
        };

        const handleKeyUp = (event) => {
            const key = event.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                setKeysPressed(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(key);
                    return newSet;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Game loop for movement and physics
    React.useEffect(() => {
        const gameLoop = setInterval(() => {
            setVelocity(prevVelocity => {
                let newVelocityX = prevVelocity.x;
                let newVelocityY = prevVelocity.y;

                // Apply acceleration based on pressed keys
                if (keysPressed.has('w')) newVelocityY -= ACCELERATION;
                if (keysPressed.has('s')) newVelocityY += ACCELERATION;
                if (keysPressed.has('a')) newVelocityX -= ACCELERATION;
                if (keysPressed.has('d')) newVelocityX += ACCELERATION;

                // Apply acceleration based on device tilt (mobile)
                if (tiltSupported) {
                    newVelocityX += tilt.x * ACCELERATION;
                    newVelocityY += tilt.y * ACCELERATION;
                }

                // Apply friction to gradually slow down
                newVelocityX *= FRICTION;
                newVelocityY *= FRICTION;

                // Stop very small velocities to prevent endless tiny movements
                if (Math.abs(newVelocityX) < MIN_VELOCITY) newVelocityX = 0;
                if (Math.abs(newVelocityY) < MIN_VELOCITY) newVelocityY = 0;

                return { x: newVelocityX, y: newVelocityY };
            });

            setBallPosition(prevPosition => {
                // Use the current velocity state, not the previous one
                setVelocity(currentVelocity => {
                    const newX = Math.max(0, Math.min(PLAYABLE_WIDTH - BALL_SIZE, prevPosition.x + currentVelocity.x));
                    const newY = Math.max(0, Math.min(PLAYABLE_HEIGHT - BALL_SIZE, prevPosition.y + currentVelocity.y));
                    
                    let updatedVelocityX = currentVelocity.x;
                    let updatedVelocityY = currentVelocity.y;
                    
                    // If ball hits boundary, stop velocity only if trying to move further into the boundary
                    if ((newX <= 0 && currentVelocity.x < 0) || (newX >= PLAYABLE_WIDTH - BALL_SIZE && currentVelocity.x > 0)) {
                        updatedVelocityX = 0;
                    }
                    if ((newY <= 0 && currentVelocity.y < 0) || (newY >= PLAYABLE_HEIGHT - BALL_SIZE && currentVelocity.y > 0)) {
                        updatedVelocityY = 0;
                    }

                    setBallPosition({ x: newX, y: newY });
                    return { x: updatedVelocityX, y: updatedVelocityY };
                });
                
                return prevPosition; // This return won't be used since we're setting position inside setVelocity
            });
        }, 16); // ~60 FPS

        return () => clearInterval(gameLoop);
    }, [keysPressed]);

    return (
        <Container style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '100vh',
            textAlign: 'center'
        }}>
            <h1 style={{ 
                fontSize: '3rem', 
                fontWeight: 'bold', 
                color: '#333',
                marginBottom: '30px'
            }}>
                Inertia
            </h1>
            
            {/* Game Screen Box */}
            <div style={{
                width: dimensions.width,
                height: dimensions.height,
                border: '3px solid #333',
                borderRadius: '10px',
                position: 'relative',
                backgroundColor: '#f8f9fa',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                boxSizing: 'border-box',
                maxWidth: '95vw', // Ensure it doesn't exceed viewport
                maxHeight: '70vh'
            }}>
                {/* Ball */}
                <div style={{
                    width: BALL_SIZE,
                    height: BALL_SIZE,
                    backgroundColor: '#007bff',
                    borderRadius: '50%',
                    position: 'absolute',
                    left: ballPosition.x,
                    top: ballPosition.y,
                    transition: 'all 0.1s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
            </div>
            
            {/* Instructions */}
            <div style={{ 
                marginTop: '20px', 
                color: '#666',
                fontSize: '1.1rem',
                textAlign: 'center'
            }}>
                <p style={{ margin: '5px 0' }}>Use WASD keys to move the ball</p>
                {!tiltSupported && (typeof DeviceOrientationEvent !== 'undefined' || typeof DeviceMotionEvent !== 'undefined') && (
                    <button 
                        onClick={requestTiltPermission}
                        style={{
                            marginTop: '10px',
                            padding: '10px 20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        Enable Tilt Controls
                    </button>
                )}
                {tiltSupported && (
                    <p style={{ margin: '5px 0', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        Tilt controls enabled - tilt your device to move
                    </p>
                )}
            </div>
        </Container>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
