# Télécharge une copie locale des données Data Dragon (JSON + images) dans ./ddragon
# A lancer depuis un réseau qui ne bloque pas Riot :
#   powershell -ExecutionPolicy Bypass -File telecharger-donnees.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue" # sinon Invoke-WebRequest est très lent
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$url = "https://ddragon.leagueoflegends.com"
$langue = "fr_FR"
$dossier = Join-Path $PSScriptRoot "ddragon"

New-Item -ItemType Directory -Force "$dossier\data\$langue", "$dossier\img\champion", "$dossier\img\item" | Out-Null

# 1. la dernière version du jeu
Invoke-WebRequest "$url/api/versions.json" -OutFile "$dossier\versions.json" -UseBasicParsing
$version = (Get-Content "$dossier\versions.json" -Raw -Encoding UTF8 | ConvertFrom-Json)[0]
Write-Host "Patch $version"

# 2. les champions et les objets, avec leurs images
foreach ($type in "champion", "item") {
    $json = "$dossier\data\$langue\$type.json"
    Invoke-WebRequest "$url/cdn/$version/data/$langue/$type.json" -OutFile $json -UseBasicParsing

    $donnees = Get-Content $json -Raw -Encoding UTF8 | ConvertFrom-Json
    $images = $donnees.data.PSObject.Properties | ForEach-Object { $_.Value.image.full } | Sort-Object -Unique
    Write-Host "$type : $($images.Count) images"

    foreach ($image in $images) {
        Invoke-WebRequest "$url/cdn/$version/img/$type/$image" -OutFile "$dossier\img\$type\$image" -UseBasicParsing
    }
}

Write-Host "Terminé : données enregistrées dans $dossier"
