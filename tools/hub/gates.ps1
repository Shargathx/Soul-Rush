param($root = (Resolve-Path "$PSScriptRoot\..\.."))
# Copies the boss gate frames the hub uses from the raw gates pack ("assets (raw)/gates/all_gates_pack", git-ignored)
# into assets/backgrounds/hub/gates, following the pack's HANDOFF.md:
# - eclipse, infernal: the "simple setup" (one sprite with inactive / active / completed).
# - torii: the active loop is split in two, so the crow can be drawn between them as HANDOFF.md asks:
#   back = portal + gate + lanterns, front = spirits + petals (stacking the layers in order rebuilds the
#   active frame pixel for pixel). Inactive and completed are whole frames. The crow frames are copied as they are.
# Run: powershell -File tools/hub/gates.ps1
Add-Type -AssemblyName System.Drawing
$Pack = "$root\assets (raw)\gates\all_gates_pack"
$Out = "$root\assets\backgrounds\hub\gates"
if (Test-Path $Out) { Remove-Item -Recurse -Force $Out }

function Frames($dir) { Get-ChildItem "$Pack\$dir" -Filter *.png | Sort-Object Name }
function CopyAnim($src, $dst, $name) {
  New-Item -ItemType Directory -Force $dst | Out-Null
  $i = 0; foreach ($f in Frames $src) { Copy-Item $f.FullName ("$dst\{0}_{1:D2}.png" -f $name, $i); $i++ }
}
# Stacks one frame from each layer folder (a single-frame layer is reused for every frame), back to front.
function Stack($layers, $dst, $name) {
  New-Item -ItemType Directory -Force $dst | Out-Null
  $lists = $layers | ForEach-Object { , @(Frames $_) }
  $n = ($lists | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
  for ($k = 0; $k -lt $n; $k++) {
    $b = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.CompositingMode = 'SourceOver'; $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
    foreach ($list in $lists) {
      $img = [System.Drawing.Image]::FromFile($list[[math]::Min($k, $list.Count - 1)].FullName)
      $g.DrawImage($img, 0, 0, 128, 128); $img.Dispose()
    }
    $g.Dispose(); $b.Save(("$dst\{0}_{1:D2}.png" -f $name, $k), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
  }
}

foreach ($gate in @('eclipse', 'infernal')) {
  foreach ($anim in @('inactive', 'active', 'completed')) { CopyAnim "${gate}_gate\frames\${gate}_$anim" "$Out\$gate" $anim }
}
$t = "torii_gate\frames"
CopyAnim "$t\torii_inactive" "$Out\torii" 'inactive'
CopyAnim "$t\torii_completed" "$Out\torii" 'completed'
Stack @("$t\torii_layer_portal", "$t\torii_layer_gate", "$t\torii_layer_lanterns") "$Out\torii" 'back'
Stack @("$t\torii_layer_spirits", "$t\torii_layer_petals") "$Out\torii" 'front'
foreach ($a in @('idle', 'hop', 'vanish', 'appear')) { foreach ($side in @('right', 'left')) {
  CopyAnim "$t\torii_crow_${a}_$side" "$Out\torii\crow" "${a}_$side"
} }
# Check: back then front must rebuild the pack's composited active frames exactly.
$bad = 0
for ($k = 0; $k -lt 48; $k += 1) {
  $ref = [System.Drawing.Bitmap]::FromFile(((Frames "$t\torii_active")[$k]).FullName)
  $b = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b); $g.CompositingMode = 'SourceOver'
  foreach ($part in @('back', 'front')) { $img = [System.Drawing.Image]::FromFile(("$Out\torii\{0}_{1:D2}.png" -f $part, $k)); $g.DrawImage($img, 0, 0, 128, 128); $img.Dispose() }
  $g.Dispose()
  for ($y = 0; $y -lt 128; $y += 1) { for ($x = 0; $x -lt 128; $x += 1) { if ($b.GetPixel($x, $y).ToArgb() -ne $ref.GetPixel($x, $y).ToArgb() -and $ref.GetPixel($x, $y).A -gt 0) { $bad++ } } }
  $b.Dispose(); $ref.Dispose()
}
"Gate frames written to $Out. Torii back+front vs the pack's active frames: $bad differing pixels."
