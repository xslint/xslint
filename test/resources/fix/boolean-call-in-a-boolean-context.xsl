<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="not(boolean(@a))">
      <xsl:value-of select="boolean(@b) and @c"/>
      <xsl:value-of select="@d and boolean(e or f)"/>
      <xsl:value-of select="every $va in g satisfies boolean($va/@h)"/>
      <xsl:value-of select="@i" use-when="boolean(@j)"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
