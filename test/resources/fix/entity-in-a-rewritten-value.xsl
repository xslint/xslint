<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:value-of select = "alpha[@x &lt; 1]/child::beta"/>
    <xsl:value-of select = "gamma[@y = &quot;z&quot;]/child::delta"/>
    <xsl:value-of select='epsilon[@w = &apos;q&apos;]/child::zeta'/>
    <xsl:value-of select = "eta[@v = 'p &amp; q']/child::theta"/>
    <xsl:value-of select = "iota[@u &gt; 3]/child::kappa"/>
  </xsl:template>
</xsl:stylesheet>
