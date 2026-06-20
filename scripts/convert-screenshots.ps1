Add-Type -AssemblyName System.Drawing
$srcDir = Join-Path $PSScriptRoot '..\screenshots'
$srcDir = (Resolve-Path $srcDir).Path
$maxWidth = 1778
$qualities = @(88, 82, 75, 68, 60, 50, 40)
$maxBytes = 500 * 1024

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

Get-ChildItem (Join-Path $srcDir '*.png') | ForEach-Object {
    $src = $_.FullName
    $dst = $src -replace '\.png$', '.jpg'
    $img = [System.Drawing.Image]::FromFile($src)
    try {
        $ratio = [Math]::Min(1.0, $maxWidth / $img.Width)
        $newW = [int]($img.Width * $ratio)
        $newH = [int]($img.Height * $ratio)
        $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
        try {
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $g.DrawImage($img, 0, 0, $newW, $newH)
            $g.Dispose()

            $written = $false
            foreach ($q in $qualities) {
                $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
                $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$q)
                if (Test-Path $dst) { Remove-Item $dst -Force }
                $bmp.Save($dst, $encoder, $params)
                $params.Dispose()
                $size = (Get-Item $dst).Length
                if ($size -le $maxBytes) {
                    Write-Host ("{0} -> {1}x{2} JPG q{3} {4} KB" -f $_.Name, $newW, $newH, $q, [Math]::Round($size/1024))
                    $written = $true
                    break
                }
            }
            if (-not $written) {
                Write-Host ("WARN {0} still over 500KB at q40 ({1} KB)" -f $_.Name, [Math]::Round((Get-Item $dst).Length/1024))
            }
        } finally { $bmp.Dispose() }
    } finally { $img.Dispose() }
}

Write-Host "Removing original .png files..."
Get-ChildItem (Join-Path $srcDir '*.png') | Remove-Item -Force
if ($LASTEXITCODE -ne 0) { Write-Host "WARN cleanup exit $LASTEXITCODE" }
Write-Host "Done."
