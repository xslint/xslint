<?xml version="1.0"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="a">
  <xsl:template match="/">
    <xsl:param name="wide"   select='@n'>
      <zz/>
    </xsl:param>
    <xsl:variable name="quoted" select='count(o)'>
      <zz/>
    </xsl:variable>
    <xsl:variable name="spaced" select = "'aa'">
      <zz/>
    </xsl:variable>
    <xsl:variable name="entity" select="o[@n &lt; 3]">
      <zz/>
    </xsl:variable>
    <xsl:variable name="wrapped"
      select='@n'>
      <zz/>
    </xsl:variable>
    <xsl:variable name="folded" select="o[@n
= 3]">
      <zz/>
    </xsl:variable>
  </xsl:template>
</xsl:stylesheet>
