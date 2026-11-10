param($root = (Resolve-Path "$PSScriptRoot\..\.."))
# Rebuilds the hub images in assets/backgrounds/hub from the raw packs in "assets (raw)/claude" (git-ignored):
# the SHADOW Series Pixel Tile Map Asset Pack 3 rocks (as they are) and Dungeon Ruins pieces (recoloured).
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
  # SHADOW rocks. The left half of the sheet is mossy, the right half bare.
  @('shadow', 'rock_root', 16, 16, 79, 48, $null),
  @('shadow', 'rock_a', 113, 16, 78, 48, $null),
  @('shadow', 'rock_small', 214, 16, 52, 41, $null),
  @('shadow', 'slab', 16, 80, 127, 50, $null),
  @('shadow', 'rock_tall', 165, 80, 54, 73, $null),
  @('shadow', 'ledge', 16, 144, 112, 19, $null),
  @('shadow', 'gate', 16, 192, 192, 167, $null),
  @('shadow', 'rock_a_bare', 402, 16, 78, 48, $null),
  @('shadow', 'rock_small_bare', 503, 16, 52, 41, $null),
  @('shadow', 'slab_bare', 305, 80, 127, 44, $null),
  @('shadow', 'rock_tall_bare', 454, 80, 54, 72, $null),
  # Dungeon Ruins pieces, recoloured to sit in the dark mossy cavern.
  @('ruins', 'moon', 448, 0, 64, 64, $null),
  @('ruins', 'mountains_far', 288, 173, 127, 35, @(38, 56, 60)),
  @('ruins', 'hills_far', 320, 144, 192, 16, @(30, 44, 48)),
  @('ruins', 'pillar_far', 384, 0, 48, 96, @(40, 54, 58)),
  @('ruins', 'arch_far', 192, 80, 80, 48, @(40, 54, 58)),
  @('ruins', 'pillar', 384, 0, 48, 96, @(30, 28, 34)),
  @('ruins', 'chain', 166, 189, 57, 13, @(26, 24, 30)),
  @('ruins', 'vine_a', 325, 0, 6, 60, @(30, 58, 44)),
  @('ruins', 'vine_b', 357, 0, 5, 40, @(30, 58, 44)),
  @('ruins', 'swords', 96, 149, 64, 27, @(34, 30, 38)),
  @('ruins', 'cross_a', 168, 140, 19, 36, @(34, 30, 38)),
  @('ruins', 'rubble', 16, 208, 48, 32, @(40, 36, 42)),
  @('ruins', 'bush', 441, 208, 71, 32, @(22, 46, 36))
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

# Cavern sky: near-black at the top, murky green-teal low down (1px wide, stretched in the game).
$h = 180; $stops = @(@(0, 6, 8, 12), @(0.5, 14, 24, 28), @(1, 30, 50, 50))
$b = New-Object System.Drawing.Bitmap 1, $h
for ($y = 0; $y -lt $h; $y++) { $t = $y / ($h - 1)
  for ($i = 0; $i -lt $stops.Count - 1; $i++) { $s = $stops[$i]; $z = $stops[$i + 1]; if ($t -ge $s[0] -and $t -le $z[0]) { $q = ($t - $s[0]) / ($z[0] - $s[0])
    $b.SetPixel(0, $y, [System.Drawing.Color]::FromArgb(255, [int]($s[1] + ($z[1] - $s[1]) * $q), [int]($s[2] + ($z[2] - $s[2]) * $q), [int]($s[3] + ($z[3] - $s[3]) * $q))); break } } }
$b.Save("$Out\sky.png"); $b.Dispose()

# Soft fog band.
$f = New-Object System.Drawing.Bitmap 256, 48
for ($y = 0; $y -lt 48; $y++) { for ($x = 0; $x -lt 256; $x++) {
  $ax = [math]::Abs([math]::Sin([math]::PI * $x / 255)); $ay = [math]::Abs([math]::Sin([math]::PI * $y / 47))
  $f.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([int](255 * [math]::Pow($ax * $ay, 1.5)), 255, 255, 255)) } }
$f.Save("$Out\fog.png"); $f.Dispose()

# Gate glow: fills the hole of the SHADOW gate (130x98 at 1x). White, so the game tints it per gate.
# A dark rim fading into a bright core.
$w = 130; $hh = 98
$g = New-Object System.Drawing.Bitmap $w, $hh
for ($y = 0; $y -lt $hh; $y++) { for ($x = 0; $x -lt $w; $x++) {
  $dx = ($x - ($w - 1) / 2) / ($w / 2); $dy = ($y - ($hh - 1) / 2) / ($hh / 2)
  $r = [math]::Min(1, [math]::Sqrt($dx * $dx + $dy * $dy))
  $k = [math]::Pow(1 - $r, 1.6)
  $v = [int](40 + 215 * $k)
  $g.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([int](150 + 105 * $k), $v, $v, $v)) } }
$g.Save("$Out\gate_glow.png"); $g.Dispose()
"Hub images written to $Out"
