# Замена модуля turtle для автопроверки: рисунок не отображается, каждый нарисованный отрезок
# выводится строкой «@@SEG x1 y1 x2 y2 цвет толщина». Страница отбирает такие строки из вывода.
import math

class Turtle:
    def __init__(self):
        self._x = 0.0
        self._y = 0.0
        self._h = 0.0
        self._down = True
        self._c = "black"
        self._w = 1
    def _seg(self, x1, y1, x2, y2):
        if abs(x1 - x2) < 0.0001 and abs(y1 - y2) < 0.0001:
            return
        print("@@SEG %s %s %s %s %s %s" % (round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2), self._c, self._w))
    def _move(self, x, y):
        if self._down:
            self._seg(self._x, self._y, x, y)
        self._x = x
        self._y = y
    def forward(self, d):
        r = math.radians(self._h)
        self._move(self._x + d * math.cos(r), self._y + d * math.sin(r))
    def backward(self, d):
        self.forward(-d)
    def left(self, a):
        self._h = (self._h + a) % 360
    def right(self, a):
        self._h = (self._h - a) % 360
    def penup(self):
        self._down = False
    def pendown(self):
        self._down = True
    def isdown(self):
        return self._down
    def goto(self, x, y=None):
        if y is None:
            y = x[1]
            x = x[0]
        self._move(x, y)
    def setx(self, x):
        self._move(x, self._y)
    def sety(self, y):
        self._move(self._x, y)
    def setheading(self, a):
        self._h = a % 360
    def home(self):
        self._move(0.0, 0.0)
        self._h = 0.0
    def pencolor(self, *c):
        if len(c) == 0:
            return self._c
        self._c = str(c[0]) if len(c) == 1 else "rgb" + str(c)
    def color(self, *c):
        if len(c) == 0:
            return self._c
        self._c = str(c[0]) if len(c) >= 1 and not isinstance(c[0], (int, float)) else "rgb" + str(c)
    def pensize(self, w=None):
        if w is None:
            return self._w
        self._w = w
    def position(self):
        return (self._x, self._y)
    def xcor(self):
        return self._x
    def ycor(self):
        return self._y
    def heading(self):
        return self._h
    def circle(self, r, extent=None, steps=None):
        if extent is None:
            extent = 360
        n = steps if steps else 36
        part = extent / float(n)
        side = 2 * abs(r) * math.sin(math.radians(part / 2))
        sign = 1 if r > 0 else -1
        self.left(sign * part / 2)
        for i in range(n):
            self.forward(side)
            self.left(sign * part)
        self.right(sign * part / 2)
    def dot(self, size=None, *c):
        pass
    def speed(self, s=None):
        pass
    def hideturtle(self):
        pass
    def showturtle(self):
        pass
    def shape(self, s=None):
        pass
    def fillcolor(self, *c):
        pass
    def begin_fill(self):
        pass
    def end_fill(self):
        pass
    def write(self, *a, **k):
        pass
    def clear(self):
        pass
    def reset(self):
        self.home()
    def stamp(self):
        pass
    def delay(self, d=None):
        pass
    def tracer(self, *a):
        pass
    def update(self):
        pass
    fd = forward
    bk = backward
    back = backward
    lt = left
    rt = right
    pu = penup
    up = penup
    pd = pendown
    down = pendown
    setpos = goto
    setposition = goto
    seth = setheading
    pos = position
    width = pensize
    ht = hideturtle
    st = showturtle

class Screen:
    def bgcolor(self, *c):
        pass
    def title(self, t):
        pass
    def tracer(self, *a):
        pass
    def update(self):
        pass
    def setup(self, *a):
        pass
    def exitonclick(self):
        pass
    def mainloop(self):
        pass
    def listen(self):
        pass
    def delay(self, d=None):
        pass

_t = Turtle()
forward = _t.forward
fd = _t.forward
backward = _t.backward
back = _t.backward
bk = _t.backward
left = _t.left
lt = _t.left
right = _t.right
rt = _t.right
penup = _t.penup
pu = _t.penup
up = _t.penup
pendown = _t.pendown
pd = _t.pendown
down = _t.pendown
isdown = _t.isdown
goto = _t.goto
setpos = _t.goto
setposition = _t.goto
setx = _t.setx
sety = _t.sety
setheading = _t.setheading
seth = _t.setheading
home = _t.home
pencolor = _t.pencolor
color = _t.color
pensize = _t.pensize
width = _t.pensize
position = _t.position
pos = _t.position
xcor = _t.xcor
ycor = _t.ycor
heading = _t.heading
circle = _t.circle
dot = _t.dot
speed = _t.speed
hideturtle = _t.hideturtle
ht = _t.hideturtle
showturtle = _t.showturtle
st = _t.showturtle
shape = _t.shape
fillcolor = _t.fillcolor
begin_fill = _t.begin_fill
end_fill = _t.end_fill
write = _t.write
clear = _t.clear
reset = _t.reset
stamp = _t.stamp
tracer = _t.tracer
update = _t.update

def Pen():
    return Turtle()

def bgcolor(*c):
    pass

def title(t):
    pass

def setup(*a):
    pass

def done():
    pass

def mainloop():
    pass

def exitonclick():
    pass

def listen():
    pass
