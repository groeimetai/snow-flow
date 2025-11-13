
- voor elke nieuwe release van snow-code moet er een github release tag uitgebracht worden, deze bouwt dan automatisch de nieuuwe binaries
- ons snow-flow project hebben we 3 onderdelen die belangrijk zijn om te 
begrijpen. 1. snow-flow: het project zelf 
(https://github.com/groeimetai/snow-flow), hier hebben we allemaal mcp tools in een
 paar servers om daarmee elke llm via snow-code met servicenow te laten praten. 2. 
snow-code: de auth flow en de TUI/cli om elke llm te configuren en te gebruioken 
(https://github.com/groeimetai/snow-code) en dan krijgen we nog de enterprise kant,
 3. snow-flow-enterprise (https://github.com/groeimetai/snow-flow-enterprise) deze 
is voor de portal, frontend en backend, en de mcp server, gebruikers kunnen een 
betaalde versie aanschaffen van snow-flow en dat geeft toegang tot extra mcp 
servers zoals Jira, Azure DevOps en Confluence, daarbij krijgen ze ook stakeholders
 seats die alleen readonly zijn maar waar stakeholders dus al hun vragen beantwoord
 mee kunnen krijgen zonder de angst te hebben dat ze iets developen. We hebben een blueprint in de enterprise met alle indepth documentatie.
- ook de snow-flow-enterprise wordt automatisch via cloud build getriggered als er een nieuwe github push is
- uiteindelijk willen we dat de gebruiker maar met 3 commands aan de slag kan, dat zijn 1. snow-flow init -> dit initieert alle project bestanden. 2. snow-flow auth login (dit is een wrapper voor snow-code auth login) -> dit is het auth proces waar de gebruiker via oauth inlogt bij servicenow, de LLM provider en optioneel met snow-flow enterprise