<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="count-avts">
  <xsl:template match="/">
    <widget note="{count(a) &gt; 0}-{count(b) = 0}" test="count(c) = 0"/>
  </xsl:template>
</xsl:stylesheet>
