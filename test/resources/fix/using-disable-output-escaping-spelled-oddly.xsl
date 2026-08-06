<?xml version="1.0"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="a">
  <xsl:template match="/">
    <xsl:value-of select="." disable-output-escaping='yes'/>
    <xsl:text disable-output-escaping = "yes">&amp;</xsl:text>
  </xsl:template>
</xsl:stylesheet>
