# Durcit la tache planifiee "Zebralsace" (a lancer en ADMINISTRATEUR).
# Reglages par defaut de schtasks : Windows arrete la tache au bout de 72 h,
# ou sur bascule batterie/onduleur - et le declencheur "au demarrage" ne la
# relance qu'au prochain boot. L'application reste eteinte entre-temps.
$ErrorActionPreference = 'Stop'
$t = Get-ScheduledTask -TaskName 'Zebralsace'

$t.Settings.ExecutionTimeLimit         = 'PT0S'   # aucune limite de duree
$t.Settings.DisallowStartIfOnBatteries = $false
$t.Settings.StopIfGoingOnBatteries     = $false
$t.Settings.StartWhenAvailable         = $true
$t.Settings.MultipleInstances          = 'IgnoreNew'
$t.Settings.RestartCount               = 3
$t.Settings.RestartInterval            = 'PT1M'

# Chien de garde : Windows retente le demarrage toutes les 5 min. Si la tache
# tourne deja, IgnoreNew la laisse tranquille ; sinon elle repart seule.
# Duration vide = repetition indefinie.
$t.Triggers[0].Repetition.Interval = 'PT5M'
$t.Triggers[0].Repetition.Duration = ''

Set-ScheduledTask -InputObject $t | Out-Null
Write-Host 'Tache Zebralsace durcie : pas de limite de duree, relance auto toutes les 5 min.'
