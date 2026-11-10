param($root = (Resolve-Path "$PSScriptRoot\..\.."))
# Draws the Leaf Ranger's sniper perch: a dark trunk at the arena edge with a branch reaching in,
# in the Deep Forest's own palette and pixel size (drawn at 1x, shown at 2x).
# Writes assets/Enemies/Leaf_Ranger/perch/perch_left.png and perch_right.png (mirrored).
Add-Type -AssemblyName System.Drawing
$W = 150; $H = 360          # 300 x 720 on screen
$TOP = 165                  # branch top surface, native px (screen y 330 with the instance at y 0)
$ink   = [System.Drawing.Color]::FromArgb(255, 0x0C, 0x11, 0x22)
$bark1 = [System.Drawing.Color]::FromArgb(255, 0x13, 0x17, 0x26)
$bark2 = [System.Drawing.Color]::FromArgb(255, 0x1A, 0x1E, 0x2C)
$moss  = [System.Drawing.Color]::FromArgb(255, 0x18, 0x40, 0x2A)
$leaf  = [System.Drawing.Color]::FromArgb(255, 0x5E, 0x90, 0x5A)
$b = New-Object System.Drawing.Bitmap $W, $H
$rng = New-Object System.Random 7
function Px($x, $y, $c) { if ($x -ge 0 -and $y -ge 0 -and $x -lt $W -and $y -lt $H) { $b.SetPixel($x, $y, $c) } }

# Trunk: 0..34 wide, slightly flaring at the root, with vertical bark streaks.
for ($y = 0; $y -lt $H; $y++) {
  $tw = 30 + [int]([math]::Max(0, $y - 300) / 6)
  for ($x = 0; $x -lt $tw; $x++) { Px $x $y $ink }
  foreach ($sx in 6, 13, 21) { if ((($y + $sx * 3) % 23) -lt 15) { Px $sx $y $bark1 } }
  if ((($y * 7) % 31) -lt 9) { Px ($tw - 3) $y $bark2 }
}
# Branch: from the trunk out to x 138, tapering from 13 px to 4 px thick, with a gentle droop then rise at the tip.
for ($x = 24; $x -le 138; $x++) {
  $t = ($x - 24) / 114.0
  $thick = [int](13 - 9 * $t)
  $sag = [int](3 * [math]::Sin($t * [math]::PI) - 2 * [math]::Max(0, $t - 0.8) * 5)
  $surf = $TOP + $sag
  for ($y = $surf; $y -lt $surf + $thick; $y++) { Px $x $y $ink }
  if (($x % 9) -lt 5) { Px $x ($surf + $thick - 2) $bark1 }
  # Moss along the top, the surface he stands on.
  if ($rng.NextDouble() -lt 0.55) { Px $x ($surf - 1) $moss }
  if ($rng.NextDouble() -lt 0.12) { Px $x ($surf - 2) $moss }
}
# Underside bracket where the branch meets the trunk.
for ($i = 0; $i -lt 14; $i++) { for ($x = 30; $x -lt 30 + (14 - $i); $x++) { Px $x ($TOP + 12 + $i) $ink } }
# Leaf clumps: dark masses with moss and a few lit leaves, like the backdrop's bushes.
function Clump($cx, $cy, $r) {
  for ($y = $cy - $r; $y -le $cy + $r; $y++) { for ($x = $cx - $r; $x -le $cx + $r; $x++) {
    $d = [math]::Sqrt(($x - $cx) * ($x - $cx) + ($y - $cy) * ($y - $cy) * 1.4)
    if ($d -le $r - $rng.NextDouble() * 1.5) {
      $c = $ink
      $roll = $rng.NextDouble()
      if ($y -lt $cy - $r * 0.2 -and $roll -lt 0.18) { $c = $moss }
      if ($y -lt $cy - $r * 0.45 -and $roll -lt 0.05) { $c = $leaf }
      Px $x $y $c } } } }
Clump 40 ($TOP - 6) 9
Clump 128 ($TOP - 3) 8
Clump 140 ($TOP + 2) 6
Clump 14 ($TOP - 30) 12
Clump 22 60 16
Clump 8 20 18

$dir = "$root\assets\Enemies\Leaf_Ranger\perch"; New-Item -ItemType Directory -Force $dir | Out-Null
$b.Save("$dir\perch_left.png", [System.Drawing.Imaging.ImageFormat]::Png)
$b.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
$b.Save("$dir\perch_right.png", [System.Drawing.Imaging.ImageFormat]::Png)
$b.Dispose()
"perch: ${W}x${H}, branch top at native y $TOP"
