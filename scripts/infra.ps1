param(
  [ValidateSet("up", "down", "logs", "ps")]
  [string]$Action = "up"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Docker = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

if (-not (Test-Path $Docker)) {
  $Docker = "docker"
}

$env:DOCKER_CONFIG = Join-Path $Root ".docker"
New-Item -ItemType Directory -Force $env:DOCKER_CONFIG | Out-Null

switch ($Action) {
  "up" {
    & $Docker compose -f (Join-Path $Root "infra\docker-compose.yml") up -d
  }
  "down" {
    & $Docker compose -f (Join-Path $Root "infra\docker-compose.yml") down
  }
  "logs" {
    & $Docker compose -f (Join-Path $Root "infra\docker-compose.yml") logs -f
  }
  "ps" {
    & $Docker compose -f (Join-Path $Root "infra\docker-compose.yml") ps
  }
}
