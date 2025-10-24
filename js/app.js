function App() {
    const { Container } = ReactBootstrap;

    React.useEffect(() => {
        document.title = "Inertia";
    }, []);

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
                fontSize: '4rem', 
                fontWeight: 'bold', 
                color: '#333',
                margin: 0
            }}>
                Inertia
            </h1>
        </Container>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
