<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{{psi}}</title>
  <link rel="stylesheet" href="/node-psi-server.css" type="text/css" />
  <!--[if IE]>
    <script src="http://html5shiv.googlecode.com/svn/trunk/html5.js"></script><![endif]-->
  <!--[if lt IE 9]>
  <script src="js/IE9.js" type="text/javascript"></script><![endif]-->
</head>
<body id="index" class="home">
  <header id="banner" class="body">
  <h1>{{name}}</h1>
  </header>
  <section id="content" class="body">
  <dl>
    <dt id="psi-label">Published Subject Indicator</dt>
    <dd id="psi-ref"><a href="{{psi}}">{{psi}}</a></h2></dd>
    {{#fields}}
    <dt>{{{label}}}</dt><dd>{{{value}}}</dd>
    {{/fields}}
  </dl>
  </section>
  <div id="otherformats" class="body">
    <h2>Other Formats</h2>
    <nav>
       <ul>
        <!--li><a href="{{pathname}}?format=xtm20">XTM 2.0</a></li-->
        <li><a href="{{pathname}}?format=jtm">JTM</a></li>
        <!--li><a href="{{pathname}}?format=ctm">CTM</a></li-->
      </ul>
    </nav>
  </div>
  <footer id="contentinfo" class="body">
    <address id="about" class="vcard body">
      <div class="footer">Page served by 
        <a href="http://github.com/jansc/node-psi-server">node-psi-server</a>
        in {{timestamp}}.
      </div>
    </address>
  </footer>
</body>
</html>
