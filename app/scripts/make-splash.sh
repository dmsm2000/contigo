#!/bin/zsh
# Gera as imagens de arranque do iOS (public/splash). Corre a partir de app/: zsh scripts/make-splash.sh (precisa do Google Chrome).
# largura altura (px físicos) ; css largura
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ICON="$PWD/public/icons/icon-512x512.png"
OUT="$PWD/public/splash"
SP=$(mktemp -d)
for size in 1080x2340 1320x2868 1206x2622 1290x2796 1179x2556 1284x2778 1170x2532 1125x2436 1242x2688 828x1792 1242x2208 750x1334; do
  w=${size%x*}; h=${size#*x}
  for mode in dark; do
    if [ $mode = dark ]; then bg="#0e0c11"; fg="#ffffff"; mu="#a39ba8"; else bg="#ffffff"; fg="#1d1520"; mu="#8a8190"; fi
    u=$((w/10))   # unidade proporcional à largura
    cat > $SP/s.html <<H
<!doctype html><meta charset=utf-8><style>
html,body{margin:0;width:${w}px;height:${h}px;background:$bg}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,system-ui,sans-serif}
img{width:$((u*3))px;height:$((u*3))px;border-radius:$((u*3*22/100))px}
b{margin-top:$((u*6/10))px;font-size:$((u*11/10))px;line-height:1;color:$fg;letter-spacing:-0.02em}
b i{font-style:normal;background:linear-gradient(135deg,#c2306f,#ee5a62 55%,#f7a55a);-webkit-background-clip:text;color:transparent}
small{margin-top:$((u*4/10))px;font-size:$((u*4/10))px;letter-spacing:.22em;color:$mu;font-weight:500}
</style><img src="file://$ICON"><b>Conti<i>·GO</i></b><small>PÃO E CEBOLA</small>
H
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=${w},${h} --screenshot="$OUT/splash-${mode}-${size}.png" "file://$SP/s.html" >/dev/null 2>&1
  done
done
ls -la $OUT | head -30
