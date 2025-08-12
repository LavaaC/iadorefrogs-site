#start-menu{
  position:absolute; left:6px; bottom:38px; width:210px; background:var(--win);
  border:2px outset var(--border-light); box-shadow:4px 4px 0 rgba(0,0,0,.25);
  padding:6px; display:flex; flex-direction:column; gap:6px; z-index:9999;
}
#start-menu.hidden{display:none}
#start-menu button{
  background:var(--win); border:2px outset var(--border-light); padding:4px 8px; text-align:left; cursor:pointer;
}
#start-menu button:active{ border:2px inset var(--border-light) }
