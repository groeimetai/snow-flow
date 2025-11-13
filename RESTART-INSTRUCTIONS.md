# 🔄 MCP Server Herstart Instructies

## Probleem
De MCP tools geven "Authentication failed: No username/password available" omdat:
- SnowCode/Claude Code gebruikt OUDE MCP server processes
- Deze oude servers hebben NIET de auth.json fallback
- De nieuwe code (v8.31.40) is beschikbaar maar niet geladen

## Oplossing: Volledige Herstart

### Stap 1: Stop SnowCode/Claude Code VOLLEDIG

**❌ NIET voldoende:**
- Window sluiten
- Tab sluiten
- "Restart" in menu

**✅ WEL voldoende:**
1. **Sluit SnowCode/Claude Code volledig af** (Command+Q op Mac, Alt+F4 op Windows)
2. **Wacht 5 seconden**
3. **Verify dat alle processes gestopt zijn:**
   ```bash
   ps aux | grep -E "snowcode|opencode|claude" | grep -v grep
   # Moet LEEG zijn (geen processes)
   ```

### Stap 2: Clean MCP Processes (optioneel maar aanbevolen)

```bash
# Stop alle oude MCP server processes
pkill -f "snow-flow-mcp" || true
pkill -f "servicenow-mcp-unified" || true

# Verify
ps aux | grep mcp | grep -v grep
# Moet ALLEEN andere MCP servers tonen (geen snow-flow)
```

### Stap 3: Herstart SnowCode/Claude Code

1. **Open SnowCode/Claude Code opnieuw**
2. **Wacht tot het volledig geladen is** (statusbar onderaan zegt "Ready")
3. **Check MCP servers:**
   - Open Command Palette (Command+Shift+P / Ctrl+Shift+P)
   - Type: "MCP"
   - Check of "servicenow-unified" in de lijst staat

### Stap 4: Verify Credentials

Run het diagnostic script:
```bash
node scripts/test-auth-flow.js
```

**Verwachte output:**
```
✅ auth.json exists at: ~/.local/share/snow-code/auth.json
✅ ServiceNow OAuth credentials found
   Instance: https://dev351277.service-now.com
   Client ID: ***8af3
   Has Refresh Token: true
✅ Authentication configured via auth.json
```

### Stap 5: Test MCP Tools

Probeer een tool in SnowCode:
```
"Maak een update set aan genaamd 'Development Changes'"
```

**✅ Verwacht result:**
```
✅ Update Set created successfully
{
  "sys_id": "...",
  "name": "Development Changes",
  "state": "in progress"
}
```

**❌ Als je nog steeds deze error ziet:**
```
❌ "Authentication failed: No username/password available for basic authentication"
```

Dan is de oude MCP server nog actief!

---

## Troubleshooting

### Problem: "Authentication failed" blijft voorkomen

**Checklist:**
1. ✅ SnowCode volledig afgesloten? (niet alleen window gesloten)
2. ✅ Oude MCP processes gestopt? (`ps aux | grep mcp`)
3. ✅ Auth.json bestaat op correcte locatie? (`ls ~/.local/share/snow-code/auth.json`)
4. ✅ SnowCode opnieuw gestart en volledig geladen?
5. ✅ MCP server config bevat credentials? (`cat ~/.config/snowcode/config.json | grep servicenow`)

### Problem: MCP server start niet

**Check logs:**
```bash
# SnowCode logs
tail -f ~/.local/share/snowcode/logs/*.log

# MCP server logs (if running)
cat /tmp/mcp-test.log
```

### Problem: Oude versie van snow-flow gebruikt

**Update global installation:**
```bash
# Check current version
npm list -g snow-flow

# Update to latest
npm install -g snow-flow@latest

# Verify
npm list -g snow-flow
# Should show: snow-flow@8.31.40 or higher
```

---

## Waarom is dit Nodig?

**SnowCode/Claude Code laadt MCP servers bij startup:**
1. Leest `~/.config/snowcode/config.json`
2. Start alle MCP servers die `"enabled": true` hebben
3. Behoudt deze server processes tot SnowCode wordt afgesloten
4. **Herlaadt NIET automatisch bij code updates**

**Daarom moet je:**
- ✅ SnowCode **volledig afsluiten** (niet alleen restart)
- ✅ Oude MCP processes **stoppen**
- ✅ SnowCode **opnieuw opstarten** om nieuwe servers te laden

---

## Verification Checklist

Na herstart, verify dat alles werkt:

- [ ] SnowCode volledig herstart
- [ ] `node scripts/test-auth-flow.js` toont ✅ credentials gevonden
- [ ] MCP tool test succesvol (bijv. update set aanmaken)
- [ ] Geen "Authentication failed" errors meer

**Als alles ✅ is: Gefeliciteerd! De MCP tools werken nu! 🎉**

---

## Snelle Test

```bash
# 1. Stop SnowCode
# 2. Run:
pkill -f "snow-flow-mcp"
pkill -f "servicenow-mcp-unified"

# 3. Verify geen MCP processes:
ps aux | grep "snow-flow" | grep -v grep
# Moet LEEG zijn

# 4. Start SnowCode
# 5. Test tool:
# "Maak een update set aan genaamd 'Test'"

# 6. Should succeed! ✅
```

---

## Volgende Keer

Na deze ene keer volledig herstarten:
- ✅ MCP servers gebruiken automatisch auth.json
- ✅ Geen handmatige configuratie meer nodig
- ✅ `snow-flow auth login` werkt out-of-the-box
- ✅ Alle toekomstige updates worden automatisch gepicked

**Dit is een eenmalige setup - daarna werkt alles automatisch! 🚀**
