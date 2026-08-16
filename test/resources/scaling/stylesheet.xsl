<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:svg="http://www.w3.org/2000/svg" xmlns:html="http://www.w3.org/1999/xhtml" xmlns:math="http://www.w3.org/1998/Math/MathML" xmlns:mine="urn:mine:SEED" xmlns:dead="urn:dead:SEED" xmlns:gone="urn:gone:SEED" version="2.0" exclude-result-prefixes="mine">
  <xsl:import href="sPREVIOUS.xsl"/>
  <xsl:template match="/">
    <xsl:call-template name="tSEEDx0"/>
  </xsl:template>
  <xsl:template name="tSEEDx0" match="//nodeSEEDx0">
    <xsl:param name="qSEEDx0"/>
    <xsl:variable name="vSEEDx0" select="child::aSEEDx0/bSEEDx0"/>
    <xsl:if test="count($vSEEDx0/cSEEDx0) = 0">
      <svg:g id="gSEEDx0" n="{ name($vSEEDx0) }">
        <html:p class="pSEEDx0">
          <xsl:value-of select="translate($vSEEDx0, 'aSEEDx0', 'bSEEDx0')"/>
        </html:p>
        <math:mi>
          <xsl:value-of select="not(not($vSEEDx0/dSEEDx0))"/>
        </math:mi>
        <xsl:value-of select="boolean($vSEEDx0/eSEEDx0)"/>
        <xsl:value-of select="string-length($vSEEDx0/fSEEDx0) &gt; 0"/>
      </svg:g>
    </xsl:if>
    <xsl:for-each select="descendant::gSEEDx0[1]/namespace::*">
      <xsl:call-template name="tSEEDx1"/>
    </xsl:for-each>
  </xsl:template>
  <xsl:template name="tSEEDx1" match="nodeSEEDx1">
    <xsl:variable name="vSEEDx1" select="child::aSEEDx1/bSEEDx1"/>
    <xsl:if test="count($vSEEDx1/cSEEDx1) = 0">
      <svg:g id="gSEEDx1" n="{ name($vSEEDx1) }">
        <html:p class="pSEEDx1">
          <xsl:value-of select="translate($vSEEDx1, 'aSEEDx1', 'bSEEDx1')"/>
        </html:p>
        <math:mi>
          <xsl:value-of select="not(not($vSEEDx1/dSEEDx1))"/>
        </math:mi>
        <xsl:value-of select="boolean($vSEEDx1/eSEEDx1)"/>
        <xsl:value-of select="string-length($vSEEDx1/fSEEDx1) &gt; 0"/>
      </svg:g>
    </xsl:if>
    <xsl:for-each select="descendant::gSEEDx1[1]/namespace::*">
      <xsl:call-template name="tSEEDx2"/>
    </xsl:for-each>
  </xsl:template>
  <xsl:template name="tSEEDx2" match="nodeSEEDx2">
    <xsl:variable name="vSEEDx2" select="child::aSEEDx2/bSEEDx2"/>
    <xsl:if test="count($vSEEDx2/cSEEDx2) = 0">
      <svg:g id="gSEEDx2" n="{ name($vSEEDx2) }">
        <html:p class="pSEEDx2">
          <xsl:value-of select="translate($vSEEDx2, 'aSEEDx2', 'bSEEDx2')"/>
        </html:p>
        <math:mi>
          <xsl:value-of select="not(not($vSEEDx2/dSEEDx2))"/>
        </math:mi>
        <xsl:value-of select="boolean($vSEEDx2/eSEEDx2)"/>
        <xsl:value-of select="string-length($vSEEDx2/fSEEDx2) &gt; 0"/>
      </svg:g>
    </xsl:if>
    <xsl:for-each select="descendant::gSEEDx2[1]/namespace::*">
      <xsl:call-template name="tSEEDx3"/>
    </xsl:for-each>
  </xsl:template>
  <xsl:template name="tSEEDx3" match="nodeSEEDx3">
    <xsl:variable name="vSEEDx3" select="child::aSEEDx3/bSEEDx3"/>
    <xsl:if test="count($vSEEDx3/cSEEDx3) = 0">
      <svg:g id="gSEEDx3" n="{ name($vSEEDx3) }">
        <html:p class="pSEEDx3">
          <xsl:value-of select="translate($vSEEDx3, 'aSEEDx3', 'bSEEDx3')"/>
        </html:p>
        <math:mi>
          <xsl:value-of select="not(not($vSEEDx3/dSEEDx3))"/>
        </math:mi>
        <xsl:value-of select="boolean($vSEEDx3/eSEEDx3)"/>
        <xsl:value-of select="string-length($vSEEDx3/fSEEDx3) &gt; 0"/>
      </svg:g>
    </xsl:if>
    <xsl:for-each select="descendant::gSEEDx3[1]/namespace::*">
      <xsl:call-template name="tSEEDx0"/>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>
