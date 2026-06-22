Add-Type -AssemblyName System.Drawing
$srcDir = Join-Path $PSScriptRoot '..\screenshots'
$srcDir = (Resolve-Path $srcDir).Path
$maxWidth = 1280
$qualities = @(90, 85, 80, 75, 68, 60, 50)
$maxBytes = 500 * 1024

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

# Rev441: redimensionar los JPG existentes a max 1280 ancho (spec oficial App Store).
# Mantiene aspect ratio original. Tambien borra 07-09 (limite 6 segun spec).
Get-ChildItem (Join-Path $srcDir '*.jpg') | ForEach-Object {
    $src = $_.FullName
    $tmp = $src + '.tmp.jpg'
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
                if (Test-Path $tmp) { Remove-Item $tmp -Force }
                $bmp.Save($tmp, $encoder, $params)
                $params.Dispose()
                $size = (Get-Item $tmp).Length
                if ($size -le $maxBytes) {
                    Write-Host ("{0} -> {1}x{2} JPG q{3} {4} KB" -f $_.Name, $newW, $newH, $q, [Math]::Round($size/1024))
                    $written = $true
                    break
                }
            }
            if (-not $written) {
                Write-Host ("WARN {0} still over 500KB at q50" -f $_.Name)
            }
        } finally { $bmp.Dispose() }
    } finally { $img.Dispose() }
    # Sobreescribir el original con el tmp
    Move-Item -Path $tmp -Destination $src -Force
}

# Rev441: limite de 6 screenshots segun App Store oficial. Eliminar 07, 08, 09.
foreach ($n in @('07_mobile.jpg','08_mobile.jpg','09_mobile.jpg')) {
    $p = Join-Path $srcDir $n
    if (Test-Path $p) { Remove-Item $p -Force; Write-Host ("Removed {0}" -f $n) }
}

Write-Host "Done."
