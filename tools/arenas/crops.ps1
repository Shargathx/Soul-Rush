param($root = (Resolve-Path "$PSScriptRoot\..\.."))
# Rebuilds the arena images in assets/backgrounds/{forest,ruins,graveyard} from the raw packs in
# "assets (raw)/claude" (git-ignored). Only the pieces the arenas use are cut.
# A tint recolours grey ruins silhouettes: each pixel becomes tint * (its grey / 74).
Add-Type -AssemblyName System.Drawing
$Raw = "$root\assets (raw)\claude"
$Out = "$root\assets\backgrounds"
$sheets = @{
  gothic = "$Raw\Tilesetv3.png"
  ruins  = "$Raw\Dungeon Ruins Tileset\Dungeon Ruins Tileset Night.png"
}
# sheet, output folder(s), name, x, y, w, h, tint
$crops = @(
  @('gothic', @('graveyard'), 'grave_a', 32, 1, 14, 14, $null),
  @('gothic', @('graveyard'), 'grave_round', 64, 9, 13, 22, $null),
  @('gothic', @('graveyard'), 'grave_plaque', 80, 11, 14, 20, $null),
  @('gothic', @('graveyard'), 'grave_cross', 97, 9, 13, 22, $null),
  @('gothic', @('graveyard'), 'mound', 2, 6, 13, 8, $null),
  @('gothic', @('graveyard'), 'pillar', 82, 35, 29, 108, $null),
  @('gothic', @('graveyard'), 'fence', 112, 42, 32, 22, $null),
  @('gothic', @('graveyard'), 'lamp_post', 146, 24, 14, 58, $null),
  @('gothic', @('graveyard'), 'angel', 224, 13, 32, 67, $null),
  @('gothic', @('graveyard'), 'dead_tree', 200, 88, 68, 72, $null),
  @('gothic', @('graveyard'), 'dead_tree_b', 162, 764, 58, 68, $null),
  @('gothic', @('graveyard'), 'obelisk', 195, 160, 25, 48, $null),
  @('gothic', @('graveyard'), 'tombstone', 231, 165, 36, 43, $null),
  @('gothic', @('graveyard'), 'knight', 7, 417, 17, 31, $null),
  @('gothic', @('graveyard'), 'arch_wall', 160, 448, 96, 128, $null),
  @('ruins', @('ruins', 'graveyard'), 'moon', 448, 0, 64, 64, $null),
  @('ruins', @('ruins', 'graveyard'), 'mountains_far', 288, 173, 127, 35, @(70, 78, 120)),
  @('ruins', @('ruins'), 'hills_far', 320, 144, 192, 16, @(52, 58, 96)),
  @('ruins', @('ruins'), 'pillar_far', 384, 0, 48, 96, @(58, 62, 100)),
  @('ruins', @('ruins'), 'arch_far', 192, 80, 80, 48, @(58, 62, 100)),
  @('ruins', @('ruins'), 'pillar_near', 384, 0, 48, 96, @(30, 30, 52)),
  @('ruins', @('ruins'), 'arch_near', 192, 80, 80, 48, @(30, 30, 52)),
  @('ruins', @('ruins'), 'cross_a', 168, 140, 19, 36, @(30, 30, 52)),
  @('ruins', @('ruins'), 'cross_b', 197, 140, 19, 36, @(30, 30, 52)),
  @('ruins', @('ruins'), 'swords', 96, 149, 64, 27, @(30, 30, 52)),
  @('ruins', @('ruins'), 'cross_small_a', 226, 160, 10, 16, @(30, 30, 52)),
  @('ruins', @('ruins'), 'chain', 166, 189, 57, 13, @(24, 24, 40)),
  @('ruins', @('ruins'), 'fence', 128, 229, 64, 11, @(24, 24, 40)),
  @('ruins', @('ruins'), 'rubble', 16, 208, 48, 32, @(34, 34, 58)),
  @('ruins', @('ruins'), 'rubble_tall', 81, 192, 31, 48, @(34, 34, 58)),
  @('ruins', @('ruins'), 'vine_a', 325, 0, 6, 60, @(28, 52, 44)),
  @('ruins', @('ruins'), 'vine_b', 357, 0, 5, 40, @(28, 52, 44)),
  @('ruins', @('ruins'), 'bush', 441, 208, 71, 32, @(12, 22, 22)),
  @('ruins', @('ruins'), 'cloud_a', 289, 229, 14, 10, $null),
  @('ruins', @('ruins'), 'cloud_b', 310, 229, 21, 9, $null)
)

$cache = @{}
foreach ($c in $crops) {
  $sheet = $c[0]
  if (-not $cache[$sheet]) { $cache[$sheet] = [System.Drawing.Bitmap]::FromFile($sheets[$sheet]) }
  $rect = New-Object System.Drawing.Rectangle $c[3], $c[4], $c[5], $c[6]
  $b = $cache[$sheet].Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $tint = $c[7]
  if ($tint) {
    for ($y = 0; $y -lt $b.Height; $y++) { for ($x = 0; $x -lt $b.Width; $x++) {
      $p = $b.GetPixel($x, $y); if ($p.A -eq 0) { continue }
      $k = (($p.R + $p.G + $p.B) / 3) / 74
      $b.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, [math]::Min(255, [int]($tint[0] * $k)), [math]::Min(255, [int]($tint[1] * $k)), [math]::Min(255, [int]($tint[2] * $k))))
    } }
  }
  foreach ($folder in $c[1]) { New-Item -ItemType Directory -Force "$Out\$folder" | Out-Null; $b.Save("$Out\$folder\$($c[2]).png", [System.Drawing.Imaging.ImageFormat]::Png) }
  $b.Dispose()
}
foreach ($k in $cache.Keys) { $cache[$k].Dispose() }

# Night sky gradients (1px wide, stretched across the screen in the game).
function Grad($out, $h, $stops) {
  $b = New-Object System.Drawing.Bitmap 1, $h
  for ($y = 0; $y -lt $h; $y++) { $t = $y / ($h - 1)
    for ($i = 0; $i -lt $stops.Count - 1; $i++) { $a = $stops[$i]; $z = $stops[$i + 1]; if ($t -ge $a[0] -and $t -le $z[0]) { $q = ($t - $a[0]) / ($z[0] - $a[0])
      $b.SetPixel(0, $y, [System.Drawing.Color]::FromArgb(255, [int]($a[1] + ($z[1] - $a[1]) * $q), [int]($a[2] + ($z[2] - $a[2]) * $q), [int]($a[3] + ($z[3] - $a[3]) * $q))); break } } }
  $b.Save($out); $b.Dispose() }
Grad "$Out\ruins\sky.png" 180 @(@(0, 10, 12, 30), @(0.55, 30, 34, 70), @(1, 62, 66, 110))
Grad "$Out\graveyard\sky.png" 180 @(@(0, 14, 10, 28), @(0.6, 40, 28, 68), @(1, 78, 52, 98))

# Soft fog band, used by the ruins and the graveyard.
$f = New-Object System.Drawing.Bitmap 256, 48
for ($y = 0; $y -lt 48; $y++) { for ($x = 0; $x -lt 256; $x++) {
  $ax = [math]::Abs([math]::Sin([math]::PI * $x / 255)); $ay = [math]::Abs([math]::Sin([math]::PI * $y / 47))
  $f.SetPixel($x, $y, [System.Drawing.Color]::FromArgb([int](255 * [math]::Pow($ax * $ay, 1.5)), 255, 255, 255)) } }
$f.Save("$Out\ruins\fog.png"); $f.Save("$Out\graveyard\fog.png"); $f.Dispose()

# Forest: the 10 still layers are merged into three images (back, mid, front). The two light-shaft
# layers sit between them and stay separate so they can pulse.
New-Item -ItemType Directory -Force "$Out\forest" | Out-Null
function Merge($out, $names) {
  $first = [System.Drawing.Image]::FromFile("$Raw\background layers\$($names[0]).png")
  $m = New-Object System.Drawing.Bitmap $first.Width, $first.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $first.Dispose()
  $g = [System.Drawing.Graphics]::FromImage($m); $g.CompositingMode = 'SourceOver'; $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
  foreach ($n in $names) { $i = [System.Drawing.Image]::FromFile("$Raw\background layers\$n.png"); $g.DrawImage($i, 0, 0, $i.Width, $i.Height); $i.Dispose() }
  $g.Dispose(); $m.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $m.Dispose() }
Merge "$Out\forest\back.png" @('Layer_0011_0', 'Layer_0010_1', 'Layer_0009_2', 'Layer_0008_3')
Merge "$Out\forest\mid.png" @('Layer_0006_4', 'Layer_0005_5')
Merge "$Out\forest\front.png" @('Layer_0003_6', 'Layer_0002_7', 'Layer_0001_8', 'Layer_0000_9')
Copy-Item "$Raw\background layers\Layer_0007_Lights.png" "$Out\forest\lights_back.png"
Copy-Item "$Raw\background layers\Layer_0004_Lights.png" "$Out\forest\lights_front.png"
"crops: $($crops.Count)"
