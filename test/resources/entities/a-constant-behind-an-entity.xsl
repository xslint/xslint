<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<!DOCTYPE xsl:stylesheet [
<!ENTITY constant "'true'">
]>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0" id="entities">
  <xsl:output encoding="UTF-8" method="xml"/>
  <xsl:template match="/">
    <xsl:if test="&constant;">
      <xsl:text>a</xsl:text>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
