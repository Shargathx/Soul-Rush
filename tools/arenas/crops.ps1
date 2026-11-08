param($root)
# Cuts arena props out of the asset sheets into assets/arenas/<arena>/<name>.png.
# A tint recolours grey silhouettes: each pixel becomes tint * (its grey / 74).
Add-Type -AssemblyName System.Drawing
$AssetDir = "$root\assets\claude"
$sheets = @{
  gothic = "$AssetDir\Tilesetv3.png"
  ruins  = "$AssetDir\Dungeon Ruins Tileset\Dungeon Ruins Tileset Night.png"
}
$crops = @(
  # Gothic graveyard
  @('gothic','grave_a',32,1,14,14), @('gothic','grave_b',49,1,14,14), @('gothic','grave_round',64,9,13,22),
  @('gothic','grave_plaque',80,11,14,20), @('gothic','grave_cross',97,9,13,22), @('gothic','mound',2,6,13,8),
  @('gothic','pillar',82,35,29,108), @('gothic','fence',112,42,32,22), @('gothic','lamp_post',146,24,14,58),
  @('gothic','angel',224,13,32,67), @('gothic','dead_tree',200,88,68,72), @('gothic','dead_tree_b',162,764,58,68),
  @('gothic','obelisk',195,160,25,48), @('gothic','tombstone',231,165,36,43), @('gothic','lantern',86,376,21,27),
  @('gothic','knight',7,417,17,31), @('gothic','arch_tower',182,383,52,64), @('gothic','arch_wall',160,448,96,128),
  @('gothic','window',196,56,24,30),
)
# Ruins: name, x, y, w, h, tint (r,g,b)
$ruins = @(
  @('moon',448,0,64,64,$null),
  @('mountains_far',288,173,127,35,@(70,78,120)), @('hills_far',320,144,192,16,@(52,58,96)),
  @('pillar_far',384,0,48,96,@(58,62,100)), @('arch_far',192,80,80,48,@(58,62,100)),
  @('pillar_near',384,0,48,96,@(30,30,52)), @('arch_near',192,80,80,48,@(30,30,52)),
  @('cross_a',168,140,19,36,@(30,30,52)), @('cross_b',197,140,19,36,@(30,30,52)), @('swords',96,149,64,27,@(30,30,52)),
  @('cross_small_a',226,160,10,16,@(30,30,52)), @('cross_small_b',244,160,10,16,@(30,30,52)),
  @('chain',166,189,57,13,@(24,24,40)), @('fence',128,229,64,11,@(24,24,40)), @('rubble',16,208,48,32,@(34,34,58)),
  @('rubble_tall',81,192,31,48,@(34,34,58)), @('vine_a',325,0,6,60,@(28,52,44)), @('vine_b',357,0,5,40,@(28,52,44)),
  @('vine_c',374,0,5,46,@(28,52,44)), @('bush',441,208,71,32,@(12,22,22)), @('bush_small',401,224,30,16,@(12,22,22)),
  @('cloud_a',289,229,14,10,$null), @('cloud_b',310,229,21,9,$null)
)
foreach ($r in $ruins) { $crops += ,@('ruins',$r[0],$r[1],$r[2],$r[3],$r[4],$r[5]) }

$cache = @{}
foreach ($c in $crops) {
  $sheet = $c[0]; $name = $c[1]
  if (-not $cache[$sheet]) { $cache[$sheet] = [System.Drawing.Bitmap]::FromFile($sheets[$sheet]) }
  $src = $cache[$sheet]
  $rect = New-Object System.Drawing.Rectangle $c[2], $c[3], $c[4], $c[5]
  $b = $src.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $tint = if ($c.Count -gt 6) { $c[6] } else { $null }
  if ($tint) {
    for ($y = 0; $y -lt $b.Height; $y++) { for ($x = 0; $x -lt $b.Width; $x++) {
      $p = $b.GetPixel($x, $y); if ($p.A -eq 0) { continue }
      $k = (($p.R + $p.G + $p.B) / 3) / 74
      $b.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, [math]::Min(255, [int]($tint[0]*$k)), [math]::Min(255, [int]($tint[1]*$k)), [math]::Min(255, [int]($tint[2]*$k))))
    } }
  }
  $dir = "$root\assets\arenas\$sheet"; New-Item -ItemType Directory -Force $dir | Out-Null
  $b.Save("$dir\$name.png", [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
}
foreach ($k in $cache.Keys) { $cache[$k].Dispose() }
# Forest layers are used whole: copy them with clean names.
$fd = "$root\assets\arenas\forest"; New-Item -ItemType Directory -Force $fd | Out-Null
foreach ($f in Get-ChildItem "$AssetDir\background layers\*.png") { $n = ($f.BaseName -replace '^Layer_\d+_', 'layer_') -replace 'Lights', 'lights'; Copy-Item $f.FullName "$fd\$($f.BaseName.ToLower()).png" }
"crops: $($crops.Count)"

