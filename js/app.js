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
            // Detect if we're on a mobile device
            const isMobile = window.innerWidth <= 768 || window.innerHeight <= 768;
            
            // Use minimal padding on mobile to maximize playable area
            const padding = isMobile ? 10 : 40; // Minimal padding on mobile
            // Reduce space reserved for title and instructions on mobile
            const uiSpace = isMobile ? 100 : 200; // Even less UI space on mobile
            
            const maxViewportWidth = window.innerWidth - padding;
            const maxViewportHeight = window.innerHeight - padding - uiSpace;
            
            // Calculate maximum possible dimensions while maintaining aspect ratio
            let newWidth = maxViewportWidth;
            let newHeight = newWidth / ASPECT_RATIO;
            
            // If height exceeds viewport, constrain by height instead
            if (newHeight > maxViewportHeight) {
                newHeight = maxViewportHeight;
                newWidth = newHeight * ASPECT_RATIO;
            }
            
            // Ensure minimum size for playability
            const minWidth = isMobile ? 280 : 300;
            const minHeight = minWidth / ASPECT_RATIO;
            
            // Allow much larger multipliers on mobile for maximum screen usage
            const maxMultiplier = isMobile ? 3.5 : 1.5; // Much larger on mobile (up to 3.5x)
            newWidth = Math.max(minWidth, Math.min(newWidth, BASE_WIDTH * maxMultiplier));
            newHeight = Math.max(minHeight, Math.min(newHeight, BASE_HEIGHT * maxMultiplier));
            
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
    const [gameOver, setGameOver] = React.useState(false);
    const [gameWon, setGameWon] = React.useState(false);
    const [pathData, setPathData] = React.useState(null);
    const [burnedPath, setBurnedPath] = React.useState([]);
    const [hasUserMoved, setHasUserMoved] = React.useState(false); // Track if user has initiated movement
    
    // Virtual joystick state for mobile
    const [joystickActive, setJoystickActive] = React.useState(false);
    const [joystickPosition, setJoystickPosition] = React.useState({ x: 0, y: 0 });
    const [joystickCenter, setJoystickCenter] = React.useState({ x: 0, y: 0 });

    // Generate random path
    const generateRandomPath = React.useCallback(() => {
        // Ensure we have valid dimensions before generating path
        if (PLAYABLE_WIDTH <= 0 || PLAYABLE_HEIGHT <= 0) {
            // Return a simple path as fallback
            return {
                points: [{ x: 50, y: 50 }, { x: 100, y: 50 }],
                width: BALL_SIZE + 20,
                start: { x: 50, y: 50 },
                end: { x: 100, y: 50 }
            };
        }
        
        const PATH_WIDTH = BALL_SIZE + 20; // Wider path for easier gameplay
        const MIN_SEGMENT_LENGTH = 100; // Longer minimum segments
        const MAX_SEGMENT_LENGTH = 200; // Much longer maximum segments
        const BORDER_BUFFER = Math.max(BALL_SIZE * 2, 40); // Ensure minimum buffer but not too large
        
        // Ensure buffer doesn't exceed half the available space
        const maxBuffer = Math.min(BORDER_BUFFER, PLAYABLE_WIDTH / 4, PLAYABLE_HEIGHT / 4);
        
        const path = [];
        let currentX = maxBuffer; // Start well away from left edge
        let currentY = PLAYABLE_HEIGHT / 2; // Start from center height
        let isHorizontal = true; // Start with horizontal movement
        
        // Add starting point - ensure it's within bounds
        currentX = Math.max(maxBuffer, Math.min(currentX, PLAYABLE_WIDTH - maxBuffer));
        currentY = Math.max(maxBuffer, Math.min(currentY, PLAYABLE_HEIGHT - maxBuffer));
        path.push({ x: currentX, y: currentY });
        
        // Generate fewer, longer path segments
        while (currentX < PLAYABLE_WIDTH - maxBuffer * 1.5) {
            // Create much longer segments
            let segmentLength = MIN_SEGMENT_LENGTH + Math.random() * (MAX_SEGMENT_LENGTH - MIN_SEGMENT_LENGTH);
            
            if (isHorizontal) {
                // Move horizontally (left to right) - use more space
                const remainingWidth = PLAYABLE_WIDTH - currentX - maxBuffer;
                segmentLength = Math.min(segmentLength, remainingWidth * 0.8); // Use 80% of remaining width
                
                currentX += segmentLength;
                // Ensure we don't exceed bounds
                currentX = Math.min(currentX, PLAYABLE_WIDTH - maxBuffer);
                path.push({ x: currentX, y: currentY });
                
                // Switch to vertical movement
                isHorizontal = false;
            } else {
                // Move vertically (up or down) - use full height range
                const goUp = Math.random() < 0.5;
                const direction = goUp ? -1 : 1;
                
                // Use much more of the vertical space but stay away from borders
                const minY = maxBuffer;
                const maxY = PLAYABLE_HEIGHT - maxBuffer;
                const availableHeight = maxY - minY;
                
                // Make vertical movements span more of the height
                let newY = currentY + (direction * segmentLength);
                
                // If we hit boundaries, use the full available space
                if (newY < minY) {
                    newY = minY;
                } else if (newY > maxY) {
                    newY = maxY;
                }
                
                // Ensure we move at least 25% of the available height
                const minMovement = availableHeight * 0.25;
                if (Math.abs(newY - currentY) < minMovement) {
                    const availableUp = currentY - minY;
                    const availableDown = maxY - currentY;
                    
                    if (availableUp > availableDown) {
                        newY = Math.max(minY, currentY - Math.max(minMovement, availableUp * 0.7));
                    } else {
                        newY = Math.min(maxY, currentY + Math.max(minMovement, availableDown * 0.7));
                    }
                }
                
                currentY = newY;
                // Ensure Y is within bounds
                currentY = Math.max(minY, Math.min(currentY, maxY));
                path.push({ x: currentX, y: currentY });
                
                // Switch to horizontal movement
                isHorizontal = true;
            }
            
            // Reduce randomness - make fewer, more deliberate turns
            if (Math.random() < 0.15) { // Reduced from 0.3 to 0.15
                segmentLength *= 0.7; // Less dramatic reduction
            }
        }
        
        // Final segment to reach the end - use full width but stay away from border
        const finalX = PLAYABLE_WIDTH - maxBuffer;
        if (!isHorizontal) {
            // If we ended on a vertical segment, add a horizontal one to reach the end
            path.push({ x: finalX, y: currentY });
        } else {
            // Extend the current horizontal segment to the end
            path[path.length - 1] = { x: finalX, y: currentY };
        }
        
        return {
            points: path,
            width: PATH_WIDTH,
            start: path[0],
            end: path[path.length - 1]
        };
    }, [PLAYABLE_WIDTH, PLAYABLE_HEIGHT, BALL_SIZE]);

    // Initialize path on component mount and dimension changes
    React.useEffect(() => {
        // Add a small delay to ensure dimensions are properly set
        const initializePath = () => {
            const newPath = generateRandomPath();
            setPathData(newPath);
            
            // Ensure ball is positioned safely within bounds
            const safeX = Math.max(0, Math.min(PLAYABLE_WIDTH - BALL_SIZE, newPath.start.x - BALL_SIZE / 2));
            const safeY = Math.max(0, Math.min(PLAYABLE_HEIGHT - BALL_SIZE, newPath.start.y - BALL_SIZE / 2));
            
            // Reset ball to start of path
            setBallPosition({
                x: safeX,
                y: safeY
            });
            setVelocity({ x: 0, y: 0 });
            setGameOver(false);
            setGameWon(false);
            setBurnedPath([]); // Reset burned path
            setHasUserMoved(false); // Reset movement flag
            setJoystickActive(false); // Reset joystick
            setJoystickPosition({ x: 0, y: 0 });
        };

        // Small delay for mobile to ensure dimensions are calculated
        if (window.innerWidth <= 768 || window.innerHeight <= 768) {
            setTimeout(initializePath, 100);
        } else {
            initializePath();
        }
    }, [generateRandomPath, PLAYABLE_WIDTH, PLAYABLE_HEIGHT]);

    // Check if ball is on path
    const isOnPath = React.useCallback((ballX, ballY) => {
        if (!pathData) return true;
        
        const ballCenterX = ballX + BALL_SIZE / 2;
        const ballCenterY = ballY + BALL_SIZE / 2;
        
        // Check distance from ball center to path
        for (let i = 0; i < pathData.points.length - 1; i++) {
            const p1 = pathData.points[i];
            const p2 = pathData.points[i + 1];
            
            // Calculate distance from point to line segment
            const A = ballCenterX - p1.x;
            const B = ballCenterY - p1.y;
            const C = p2.x - p1.x;
            const D = p2.y - p1.y;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            if (lenSq !== 0) param = dot / lenSq;
            
            let xx, yy;
            if (param < 0) {
                xx = p1.x;
                yy = p1.y;
            } else if (param > 1) {
                xx = p2.x;
                yy = p2.y;
            } else {
                xx = p1.x + param * C;
                yy = p1.y + param * D;
            }
            
            const dx = ballCenterX - xx;
            const dy = ballCenterY - yy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= pathData.width / 2) {
                return true;
            }
        }
        return false;
    }, [pathData, BALL_SIZE]);

    // Check if ball reached the end
    const hasReachedEnd = React.useCallback((ballX, ballY) => {
        if (!pathData) return false;
        
        const ballCenterX = ballX + BALL_SIZE / 2;
        const ballCenterY = ballY + BALL_SIZE / 2;
        const endX = pathData.end.x;
        const endY = pathData.end.y;
        
        const distance = Math.sqrt((ballCenterX - endX) ** 2 + (ballCenterY - endY) ** 2);
        return distance <= pathData.width / 2;
    }, [pathData, BALL_SIZE]);

    // Reset game
    const resetGame = () => {
        // Force recalculate dimensions first on mobile to ensure we have current values
        if (window.innerWidth <= 768 || window.innerHeight <= 768) {
            // Small delay to ensure dimensions are properly calculated
            setTimeout(() => {
                const newPath = generateRandomPath();
                setPathData(newPath);
                
                // Ensure ball is positioned safely within bounds
                const safeX = Math.max(0, Math.min(PLAYABLE_WIDTH - BALL_SIZE, newPath.start.x - BALL_SIZE / 2));
                const safeY = Math.max(0, Math.min(PLAYABLE_HEIGHT - BALL_SIZE, newPath.start.y - BALL_SIZE / 2));
                
                setBallPosition({
                    x: safeX,
                    y: safeY
                });
                setVelocity({ x: 0, y: 0 });
                setGameOver(false);
                setGameWon(false);
                setBurnedPath([]); // Reset burned path
                setHasUserMoved(false); // Reset movement flag
                setJoystickActive(false); // Reset joystick
                setJoystickPosition({ x: 0, y: 0 });
            }, 50);
        } else {
            // Desktop - immediate reset
            const newPath = generateRandomPath();
            setPathData(newPath);
            
            // Ensure ball is positioned safely within bounds
            const safeX = Math.max(0, Math.min(PLAYABLE_WIDTH - BALL_SIZE, newPath.start.x - BALL_SIZE / 2));
            const safeY = Math.max(0, Math.min(PLAYABLE_HEIGHT - BALL_SIZE, newPath.start.y - BALL_SIZE / 2));
            
            setBallPosition({
                x: safeX,
                y: safeY
            });
            setVelocity({ x: 0, y: 0 });
            setGameOver(false);
            setGameWon(false);
            setBurnedPath([]); // Reset burned path
            setHasUserMoved(false); // Reset movement flag
            setJoystickActive(false); // Reset joystick
            setJoystickPosition({ x: 0, y: 0 });
        }
    };

    // Add burned section to path when ball moves
    const addBurnedSection = React.useCallback((x, y) => {
        const ballCenterX = x + BALL_SIZE / 2;
        const ballCenterY = y + BALL_SIZE / 2;
        
        setBurnedPath(prevBurned => {
            // Check if this position is already burned (to avoid duplicates)
            const isAlreadyBurned = prevBurned.some(point => 
                Math.abs(point.x - ballCenterX) < 5 && Math.abs(point.y - ballCenterY) < 5
            );
            
            if (isAlreadyBurned) return prevBurned;
            
            // Add new burned section
            return [...prevBurned, { 
                x: ballCenterX, 
                y: ballCenterY,
                burnIntensity: 0.9 + Math.random() * 0.1 // Slight variation in burn intensity
            }];
        });
    }, [BALL_SIZE]);

    // Virtual joystick handlers for mobile
    const handleJoystickStart = React.useCallback((e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        setJoystickCenter({ x: centerX, y: centerY });
        setJoystickActive(true);
        setJoystickPosition({ x: 0, y: 0 });
    }, []);

    const handleJoystickMove = React.useCallback((e) => {
        if (!joystickActive) return;
        
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const deltaX = touch.clientX - joystickCenter.x;
        const deltaY = touch.clientY - joystickCenter.y;
        
        // Limit joystick movement to a 50px radius
        const maxDistance = 50;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance <= maxDistance) {
            setJoystickPosition({ x: deltaX, y: deltaY });
        } else {
            // Constrain to circle boundary
            const angle = Math.atan2(deltaY, deltaX);
            setJoystickPosition({
                x: Math.cos(angle) * maxDistance,
                y: Math.sin(angle) * maxDistance
            });
        }
    }, [joystickActive, joystickCenter]);

    const handleJoystickEnd = React.useCallback((e) => {
        e.preventDefault();
        setJoystickActive(false);
        setJoystickPosition({ x: 0, y: 0 });
    }, []);

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
                let userInputDetected = false;

                // Apply acceleration based on pressed keys
                if (keysPressed.has('w')) {
                    newVelocityY -= ACCELERATION;
                    userInputDetected = true;
                }
                if (keysPressed.has('s')) {
                    newVelocityY += ACCELERATION;
                    userInputDetected = true;
                }
                if (keysPressed.has('a')) {
                    newVelocityX -= ACCELERATION;
                    userInputDetected = true;
                }
                if (keysPressed.has('d')) {
                    newVelocityX += ACCELERATION;
                    userInputDetected = true;
                }

                // Apply acceleration based on device tilt (mobile)
                if (tiltSupported && (Math.abs(tilt.x) > 0.1 || Math.abs(tilt.y) > 0.1)) {
                    newVelocityX += tilt.x * ACCELERATION;
                    newVelocityY += tilt.y * ACCELERATION;
                    userInputDetected = true;
                }

                // Apply acceleration based on virtual joystick (mobile)
                if (joystickActive && (Math.abs(joystickPosition.x) > 5 || Math.abs(joystickPosition.y) > 5)) {
                    const joystickStrength = 0.02; // Adjust sensitivity
                    newVelocityX += (joystickPosition.x / 50) * ACCELERATION * joystickStrength * 25;
                    newVelocityY += (joystickPosition.y / 50) * ACCELERATION * joystickStrength * 25;
                    userInputDetected = true;
                }

                // Set movement flag if user input detected
                if (userInputDetected && !hasUserMoved) {
                    setHasUserMoved(true);
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
                    
                    // Add burned section when ball moves
                    if (Math.abs(currentVelocity.x) > 0.1 || Math.abs(currentVelocity.y) > 0.1) {
                        addBurnedSection(newX, newY);
                    }
                    
                    // Check game conditions - only check for falling off path after user has moved
                    if (hasUserMoved && !isOnPath(newX, newY) && !gameOver && !gameWon) {
                        setGameOver(true);
                        return { x: 0, y: 0 }; // Stop movement
                    }
                    
                    if (hasReachedEnd(newX, newY) && !gameOver && !gameWon) {
                        setGameWon(true);
                        return { x: 0, y: 0 }; // Stop movement
                    }
                    
                    return { x: updatedVelocityX, y: updatedVelocityY };
                });
                
                return prevPosition; // This return won't be used since we're setting position inside setVelocity
            });
        }, 16); // ~60 FPS

        return () => clearInterval(gameLoop);
    }, [keysPressed, isOnPath, hasReachedEnd, gameOver, gameWon, addBurnedSection, hasUserMoved, tiltSupported, tilt, joystickActive, joystickPosition]);

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
                fontSize: window.innerWidth <= 768 ? '2rem' : '3rem', 
                fontWeight: 'bold', 
                color: '#333',
                marginBottom: window.innerWidth <= 768 ? '15px' : '30px'
            }}>
                Inertia
            </h1>
            
            {/* Game Screen Box */}
            <div 
                id="game-container"
                style={{
                    width: dimensions.width,
                    height: dimensions.height,
                    border: '3px solid #333',
                    borderRadius: '10px',
                    position: 'relative',
                    backgroundColor: '#0a0a0a', // Dark abyss background
                    backgroundImage: `
                        radial-gradient(circle at 20% 30%, rgba(139, 0, 0, 0.3) 0%, transparent 50%),
                        radial-gradient(circle at 80% 70%, rgba(75, 0, 130, 0.2) 0%, transparent 40%),
                        radial-gradient(circle at 40% 80%, rgba(139, 0, 0, 0.2) 0%, transparent 35%),
                        radial-gradient(circle at 70% 20%, rgba(25, 25, 112, 0.3) 0%, transparent 45%),
                        linear-gradient(45deg, rgba(0, 0, 0, 0.9) 0%, rgba(25, 25, 25, 0.8) 100%)
                    `,
                    boxShadow: `
                        0 4px 8px rgba(0,0,0,0.3),
                        inset 0 0 50px rgba(139, 0, 0, 0.1),
                        inset 0 0 100px rgba(0, 0, 0, 0.8)
                    `,
                    boxSizing: 'border-box',
                    maxWidth: '95vw', // Ensure it doesn't exceed viewport
                    maxHeight: '70vh',
                    overflow: 'hidden',
                    touchAction: 'manipulation' // Optimize for touch
                }}>
                {/* Abyss animated background effect */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `
                        radial-gradient(circle at 30% 40%, rgba(139, 0, 0, 0.15) 0%, transparent 60%),
                        radial-gradient(circle at 70% 60%, rgba(75, 0, 130, 0.1) 0%, transparent 50%),
                        radial-gradient(circle at 50% 20%, rgba(220, 20, 60, 0.08) 0%, transparent 40%)
                    `,
                    animation: 'abyssFloat 8s ease-in-out infinite alternate',
                    zIndex: 1
                }} />
                
                {/* Floating danger particles */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `
                        radial-gradient(circle at 15% 25%, rgba(255, 69, 0, 0.1) 1px, transparent 1px),
                        radial-gradient(circle at 85% 75%, rgba(139, 0, 0, 0.1) 1px, transparent 1px),
                        radial-gradient(circle at 45% 85%, rgba(255, 20, 147, 0.1) 1px, transparent 1px),
                        radial-gradient(circle at 75% 15%, rgba(128, 0, 128, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px, 80px 80px, 60px 60px, 70px 70px',
                    animation: 'particleFloat 12s linear infinite',
                    zIndex: 1
                }} />

                {/* Path */}
                {pathData && (
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none'
                        }}
                    >
                        {/* Original path line with enhanced visibility */}
                        <path
                            d={`M ${pathData.points.map(p => `${p.x},${p.y}`).join(' L ')}`}
                            stroke="#32CD32"
                            strokeWidth={pathData.width}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="miter"
                            filter="url(#pathGlow)"
                        />
                        
                        {/* Path safety glow */}
                        <path
                            d={`M ${pathData.points.map(p => `${p.x},${p.y}`).join(' L ')}`}
                            stroke="#90EE90"
                            strokeWidth={pathData.width + 4}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="miter"
                            opacity="0.3"
                        />
                        
                        {/* Burned trail effect */}
                        {burnedPath.length > 0 && burnedPath.map((burnSpot, index) => (
                            <circle
                                key={index}
                                cx={burnSpot.x}
                                cy={burnSpot.y}
                                r={pathData.width / 3}
                                fill="url(#burnedGrassGradient)"
                                opacity={burnSpot.burnIntensity}
                            />
                        ))}
                        
                        {/* Gradient definitions for burned effect */}
                        <defs>
                            {/* Path glow filter */}
                            <filter id="pathGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                <feMerge> 
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                            
                            <radialGradient id="burnedGrassGradient" cx="50%" cy="50%" r="60%">
                                <stop offset="0%" stopColor="#2F1B14" stopOpacity="0.9" />
                                <stop offset="30%" stopColor="#654321" stopOpacity="0.8" />
                                <stop offset="60%" stopColor="#8B4513" stopOpacity="0.6" />
                                <stop offset="80%" stopColor="#A0522D" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#D2B48C" stopOpacity="0.2" />
                            </radialGradient>
                        </defs>
                        
                        {/* Start marker */}
                        <circle
                            cx={pathData.start.x}
                            cy={pathData.start.y}
                            r={pathData.width / 2 + 2}
                            fill="none"
                            stroke="#007bff"
                            strokeWidth="3"
                        />
                        {/* End marker */}
                        <circle
                            cx={pathData.end.x}
                            cy={pathData.end.y}
                            r={pathData.width / 2 + 2}
                            fill="none"
                            stroke="#dc3545"
                            strokeWidth="3"
                        />
                    </svg>
                )}
                
                {/* Ball */}
                <div style={{
                    width: BALL_SIZE,
                    height: BALL_SIZE,
                    backgroundColor: '#007bff',
                    borderRadius: '50%',
                    position: 'absolute',
                    left: ballPosition.x,
                    top: ballPosition.y,
                    transition: gameOver || gameWon ? 'none' : 'all 0.1s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 10,
                    background: `radial-gradient(circle at 30% 30%, #87CEEB, #007bff, #000080)`
                }} />
            </div>
            
            {/* CSS animations for abyss effects */}
            <style>{`
                @keyframes abyssFloat {
                    0% { transform: translateY(0px) scale(1); opacity: 0.6; }
                    50% { transform: translateY(-10px) scale(1.05); opacity: 0.8; }
                    100% { transform: translateY(0px) scale(1); opacity: 0.6; }
                }
                
                @keyframes particleFloat {
                    0% { transform: translateX(0px) translateY(0px); }
                    25% { transform: translateX(5px) translateY(-3px); }
                    50% { transform: translateX(-3px) translateY(5px); }
                    75% { transform: translateX(-5px) translateY(-2px); }
                    100% { transform: translateX(0px) translateY(0px); }
                }
                
                @keyframes abyssPulse {
                    0%, 100% { box-shadow: inset 0 0 50px rgba(139, 0, 0, 0.1), inset 0 0 100px rgba(0, 0, 0, 0.8); }
                    50% { box-shadow: inset 0 0 70px rgba(139, 0, 0, 0.2), inset 0 0 120px rgba(0, 0, 0, 0.9); }
                }
            `}</style>
            
            {/* Instructions */}
            <div style={{ 
                marginTop: window.innerWidth <= 768 ? '10px' : '20px', 
                color: '#666',
                fontSize: window.innerWidth <= 768 ? '0.9rem' : '1.1rem',
                textAlign: 'center'
            }}>
                <p style={{ margin: window.innerWidth <= 768 ? '2px 0' : '5px 0' }}>
                    Guide the ball along the green path from start (blue) to finish (red)
                </p>
                <p style={{ margin: window.innerWidth <= 768 ? '2px 0' : '5px 0', fontSize: '0.85rem' }}>
                    {window.innerWidth <= 768 ? 'Use WASD keys or the virtual joystick below' : 'Use WASD keys to move the ball'}
                </p>
                {!tiltSupported && (typeof DeviceOrientationEvent !== 'undefined' || typeof DeviceMotionEvent !== 'undefined') && (
                    <button 
                        onClick={requestTiltPermission}
                        style={{
                            marginTop: window.innerWidth <= 768 ? '5px' : '10px',
                            padding: window.innerWidth <= 768 ? '8px 16px' : '10px 20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: window.innerWidth <= 768 ? '0.85rem' : '1rem'
                        }}
                    >
                        Enable Tilt Controls
                    </button>
                )}
                {tiltSupported && window.innerWidth > 768 && (
                    <p style={{ margin: '5px 0', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        Tilt controls enabled - tilt your device to move
                    </p>
                )}
            </div>
            
            {/* Virtual Joystick for Mobile */}
            {window.innerWidth <= 768 && (
                <div style={{
                    marginTop: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <div
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            border: '3px solid #666',
                            backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            position: 'relative',
                            touchAction: 'none',
                            userSelect: 'none'
                        }}
                        onTouchStart={handleJoystickStart}
                        onTouchMove={handleJoystickMove}
                        onTouchEnd={handleJoystickEnd}
                        onMouseDown={handleJoystickStart}
                        onMouseMove={handleJoystickMove}
                        onMouseUp={handleJoystickEnd}
                        onMouseLeave={handleJoystickEnd}
                    >
                        {/* Joystick knob */}
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: joystickActive ? '#007bff' : '#666',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: `translate(calc(-50% + ${joystickPosition.x}px), calc(-50% + ${joystickPosition.y}px))`,
                            transition: joystickActive ? 'none' : 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            border: '2px solid white'
                        }} />
                        
                        {/* Center dot */}
                        <div style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            backgroundColor: '#999',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }} />
                    </div>
                </div>
            )}
            
            {/* Game Over Modal */}
            {gameOver && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '15px',
                        textAlign: 'center',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                        maxWidth: '90vw'
                    }}>
                        <h2 style={{ color: '#dc3545', marginBottom: '20px', fontSize: '2rem' }}>Game Over!</h2>
                        <p style={{ marginBottom: '25px', fontSize: '1.2rem', color: '#666' }}>
                            You fell off the path. Try again!
                        </p>
                        <button
                            onClick={resetGame}
                            style={{
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '12px 30px',
                                fontSize: '1.1rem',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}
            
            {/* Game Won Modal */}
            {gameWon && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '15px',
                        textAlign: 'center',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                        maxWidth: '90vw'
                    }}>
                        <h2 style={{ color: '#28a745', marginBottom: '20px', fontSize: '2rem' }}>Congratulations! 🎉</h2>
                        <p style={{ marginBottom: '25px', fontSize: '1.2rem', color: '#666' }}>
                            You successfully completed the path!
                        </p>
                        <button
                            onClick={resetGame}
                            style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '12px 30px',
                                fontSize: '1.1rem',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            )}
        </Container>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
