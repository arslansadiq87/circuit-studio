"""Generate small, embedded finish textures; no source CAD geometry is changed."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import random
out=Path('artifacts/esp30-textures');out.mkdir(exist_ok=True)
fontpath='C:/Windows/Fonts/consola.ttf'
def font(n):return ImageFont.truetype(fontpath,n)
def noise_image(size,base,seed,amplitude=2):
 rng=random.Random(seed)
 image=Image.new('RGB',size)
 image.putdata([tuple(max(0,min(255,c+rng.randint(-amplitude,amplitude))) for c in base) for _ in range(size[0]*size[1])])
 return image
w,h=768,1376
board=noise_image((w,h),(22,29,27),30,1);d=ImageDraw.Draw(board)
def xy(x,y):return ((x+14.5)/29*w,(26-y)/52*h)
left=['EN','VP','VN','34','35','32','33','25','26','27','14','12','13','GND','VIN']
right=['23','22','TX0','RX0','21','19','18','5','TX2','RX2','4','2','15','GND','3V3']
for i in range(15):
 y=42.8309514327-i*2.54-23.368
 d.text(xy(-10.7,y),left[i],font=font(20),fill=(225,229,217),anchor='rm')
 d.text(xy(10.7,y),right[i],font=font(20),fill=(225,229,217),anchor='lm')
d.text(xy(0,-18.1),'ESP32',font=font(26),fill=(213,221,208),anchor='mm')
d.text(xy(-8,-23.8),'EN',font=font(20),fill=(224,228,214),anchor='mm')
d.text(xy(8,-23.8),'BOOT',font=font(20),fill=(224,228,214),anchor='mm')
board.save(out/'pcb-color.png',optimize=True)
shield=noise_image((512,600),(185,190,190),31,1);d=ImageDraw.Draw(shield)
d.rounded_rectangle((12,12,499,587),radius=12,outline=(144,150,150),width=2)
d.text((256,170),'ESP32',font=font(72),fill=(41,46,47),anchor='mm')
d.text((256,252),'WROOM-32',font=font(45),fill=(48,53,54),anchor='mm')
d.text((256,344),'Wi-Fi + Bluetooth',font=font(28),fill=(63,68,69),anchor='mm')
d.text((256,401),'3.3V LOGIC',font=font(26),fill=(63,68,69),anchor='mm')
shield.save(out/'shield-color.png',optimize=True)
# Packed glTF metallic/roughness channels: G = roughness, B = metalness.
rng=random.Random(32);finish=Image.new('RGB',(128,128));pixels=[]
for y in range(128):
 row=rng.randint(-5,5)
 for x in range(128):pixels.append((255,107+row+rng.randint(-2,2),220))
finish.putdata(pixels);finish.save(out/'shield-finish.png',optimize=True)
ant=Image.new('RGB',(512,190),(22,31,27));ad=ImageDraw.Draw(ant)
path=[(34,174),(34,26),(99,26),(99,139),(166,139),(166,26),(234,26),(234,139),(302,139),(302,26),(370,26),(370,174),(466,174)]
ad.line(path,fill=(187,145,57),width=13,joint='curve');ant.save(out/'antenna-color.png',optimize=True)
antfinish=Image.new('RGB',(512,190),(255,182,0));ImageDraw.Draw(antfinish).line(path,fill=(255,100,210),width=13,joint='curve');antfinish.save(out/'antenna-finish.png',optimize=True)
print('Generated PCB, shield label and brushed finish textures')
