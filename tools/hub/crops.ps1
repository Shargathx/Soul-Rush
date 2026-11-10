param($root = (Resolve-Path "$PSScriptRoot\..\.."))
# Rebuilds the hub's cropped and generated images in assets/backgrounds/hub (cathedral.js and lights.js draw the rest)
# from the raw packs in "assets (raw)/claude" (git-ignored): a few recoloured Dungeon Ruins pieces, a fog band and the gate glow.
# Also writes the hub's tinted copy of the Dungeon Ruins tile atlas to assets/tilemaps/ruins/ruins_hub.png.
# Run: powershell -File tools/hub/crops.ps1
Add-Type -AssemblyName System.Drawing
$Raw = "$root\assets (raw)\claude"
$Out = "$root\assets\backgrounds\hub"
New-Item -ItemType Directory -Force $Out | Out-Null
$sheets = @{
  shadow = "$Raw\SHADOW Series - Pixel Tile Map Asset Pack 3\tile map.png"
  ruins  = "$Raw\Dungeon Ruins Tileset\Dungeon Ruins Tileset Night.png"
}
# The ruins art is flat grey (74). A tint recolours it: each pixel becomes tint * (its grey / 74).
function Tint($b, $tint) {
  for ($y = 0; $y -lt $b.Height; $y++) { for ($x = 0; $x -lt $b.Width; $x++) {
    $p = $b.GetPixel($x, $y); if ($p.A -eq 0) { continue }
    $k = (($p.R + $p.G + $p.B) / 3) / 74
    $b.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, [math]::Min(255, [int]($tint[0] * $k)), [math]::Min(255, [int]($tint[1] * $k)), [math]::Min(255, [int]($tint[2] * $k))))
  } }
}
# sheet, name, x, y, w, h, tint
$crops = @(
  # Dungeon Ruins pieces, recoloured. (The SHADOW rocks and most props were removed from the hub on 2026-11-11.)
  @('ruins', 'chain', 166, 189, 57, 13, @(26, 24, 30)),
  @('ruins', 'vine_b', 357, 0, 5, 40, @(30, 58, 44))
)
$cache = @{}
foreach ($c in $crops) {
  $sheet = $c[0]
  if (-not $cache[$sheet]) { $cache[$sheet] = [System.Drawing.Bitmap]::FromFile($sheets[$sheet]) }
  $rect = New-Object System.Drawing.Rectangle $c[2], $c[3], $c[4], $c[5]
  $b = $cache[$sheet].Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  if ($c[6]) { Tint $b $c[6] }
  $b.Save("$Out\$($c[1]).png", [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
}

# The hub's tile atlas: the whole Dungeon Ruins sheet in a warm dark stone, so the floor matches the SHADOW rocks.
$a = New-Object System.Drawing.Bitmap $cache['ruins']
Tint $a @(62, 54, 58)
$a.Save("$root\assets\tilemaps\ruins\ruins_hub.png", [System.Drawing.Imaging.ImageFormat]::Png); $a.Dispose()
foreach ($k in $cache.Keys) { $cache[$k].Dispose() }

# Soft fog band.
$f = New-Object System.Drawing.Bitmap 256, 48
for ($y = 0; $y -lt 48; $y++) { for ($x = 0; $x -lt 256; $x++) {
  $ax = [math]::Abs([math]::Sin([math]::PI * $x / 255)); $ay = [math]::Abs([math]::Sin([math]::PI * $y / 47))
  $f.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([int](255 * [math]::Pow($ax * $ay, 1.5)), 255, 255, 255)) } }
$f.Save("$Out\fog.png"); $f.Dispose()

# Gate glow (130x98 at 1x): a soft oval of light that fades to nothing at its edges, so it stands on its own
# as a portal now that the SHADOW gate frames are gone. White, so the game tints it per gate.
$w = 130; $hh = 98
$g = New-Object System.Drawing.Bitmap $w, $hh
for ($y = 0; $y -lt $hh; $y++) { for ($x = 0; $x -lt $w; $x++) {
  $dx = ($x - ($w - 1) / 2) / ($w / 2); $dy = ($y - ($hh - 1) / 2) / ($hh / 2)
  $r = [math]::Min(1, [math]::Sqrt($dx * $dx + $dy * $dy))
  $k = [math]::Pow(1 - $r, 1.3)
  $v = [int](190 + 65 * $k)
  $g.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([int](255 * $k), $v, $v, $v)) } }
$g.Save("$Out\gate_glow.png"); $g.Dispose()
"Hub images written to $Out"
